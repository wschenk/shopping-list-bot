import { Context, Telegraf } from "telegraf";
import process from "node:process";
import fs from "node:fs";
import dotenv from "dotenv";
import { addMessage, processContext, startContext } from "./generateObject";

dotenv.config();

interface StoreSection {
  name: string;
  items: string[];
}

interface SessionData {
  foodList: string[];
  sections: StoreSection[];
}

async function loadSession(ctx: Context): Promise<SessionData> {
  const from = ctx.from;
  const userId = from?.id;
  if (fs.existsSync(`sessions/${userId}.json`)) {
    return JSON.parse(
      fs.readFileSync(`sessions/${userId}.json`, "utf8")
    ) as SessionData;
  } else {
    return {
      foodList: [],
      sections: [],
    };
  }
}

async function saveSession(ctx: Context, session: SessionData): Promise<void> {
  const fileName = `sessions/${ctx.from?.id}.json`;
  if (!fs.existsSync(`sessions/`)) {
    fs.mkdirSync(`sessions/`);
  }
  fs.writeFileSync(fileName, JSON.stringify(session, null, 2));
}

const systemPrompt = `
make a list of all the items that are mentioned with 
what area they are found in in grocery store grouped 
by where they are found, dont add any commentary
`;

async function getFoodItems(session: SessionData): Promise<void> {
  const concatenatedString = session.foodList.join(" ");

  const ctx = startContext("ollama/llama3.1", systemPrompt);
  addMessage(ctx, concatenatedString);
  console.log("Running llm");
  const result = await processContext(ctx);
  console.log("result", JSON.stringify(result, null, 2));

  session.sections = [];
  for (const section of result["object"]["store_section"]) {
    session.sections.push({
      name: section["name"],
      items: section["items"],
    });
  }
}

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

bot.telegram.getMe().then((botInfo) => {
  console.log("Starting bot");
  console.log("Bot info:", botInfo);
});

// Define the list of commands
const commands = [
  { command: "start", description: "Start the bot" },
  { command: "info", description: "Get information about the bot" },
  { command: "food", description: "Set the shopping list" },
  { command: "items", description: "Get the shopping list" },
  { command: "clear", description: "Clear the shopping list" },
];

// Set the commands when the bot starts
bot.telegram.setMyCommands(commands);

// Start command
bot.start((ctx) => {
  const user = ctx.update.message?.from;

  console.log("Got a message from", user.first_name, user.last_name, user.id);
  ctx.reply("Welcome! I am your new Telegram bot.");
});

// '/info' command
bot.command("info", async (ctx) => {
  const session = await loadSession(ctx);

  await ctx.reply("Hello");
});

bot.command("food", async (ctx) => {
  await ctx.sendChatAction("upload_document");
  console.log("ctx", ctx);
  console.log("from", ctx.from);
  const session = await loadSession(ctx);
  session.foodList.push(ctx.payload);
  try {
    await getFoodItems(session);
    await saveSession(ctx, session);
    const items = itemsFromSections(session.sections);
    await ctx.reply(items);
  } catch (error) {
    console.error("Error processing food items:", error);
    await ctx.reply(
      "An error occurred while processing your food list. Please try again."
    );
  }
});

bot.command("items", async (ctx) => {
  const session = await loadSession(ctx);
  const items = itemsFromSections(session.sections);
  await ctx.reply(items);
});

bot.command("clear", async (ctx) => {
  const session = await loadSession(ctx);
  session.foodList = [];
  session.sections = [];
  await saveSession(ctx, session);
  await ctx.reply("Shopping list cleared");
});

// Echo message back
bot.on("text", async (ctx) => {
  console.log("ctx", ctx);
  await ctx.reply(ctx.message.text);
});

// Error handling
bot.catch((err, ctx) => {
  console.error(`Error occurred for user ${ctx.from?.id}:`, err);
  ctx.reply("An error occurred. Please try again later.");
});

bot.launch();

// Enable graceful stop
process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

function itemsFromSections(sections: StoreSection[]) {
  let items = "";
  for (const section of sections) {
    items += `${section.name}\n`;
    for (const item of section.items) {
      items += `- ${item}\n`;
    }
    items += "\n";
  }
  return items;
}
