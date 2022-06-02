import { Client } from "@notionhq/client";
import { Telegraf } from "telegraf";

import * as constants from "./additional.js";

import dotenv from "dotenv";

dotenv.config();

const notion = new Client({ auth: process.env.SECRET_NOTION });
//const database_test = process.env.TEST_DATABASE;
const database_video = process.env.DATABASE_VIDEO;
const database_gtd = process.env.DATABASE_GTD;

const propertyGetters = {
  url: (obj) => obj?.url,
  select: (obj) => obj?.select?.name,
  title: (obj) => obj?.title?.[0]?.plain_text,
  people: (obj) => obj?.people?.map((v) => v.name).join(", ") || null,
  date: (obj) => obj?.date?.start,
  email: (obj) => obj?.email,
  phone_number: (obj) => obj?.phone_number,
  checkbox: (obj) => obj?.checkbox,
  number: (obj) => obj?.number,
  multi_select: (obj) =>
    obj.multi_select?.map((v) => v.name).join(", ") || null,
  files: (obj) => null,
};

// get value of propery called "propName"
function getPropVal(page, propName) {
  const prop = page.properties[propName];
  return propertyGetters[prop?.type]?.(prop);
}

// get type of propery called "propName"
function getType(page, propName) {
  const prop = page.properties[propName];
  return prop?.type;
}

//get value of type from page
function getByTypeFromPage(page, type = "title") {
  let resp = "";
  for (let i of Object.keys(page.properties)) {
    if (getType(page, i) == type) {
      if (type == "title") {
        resp += `*${getPropVal(page, i)}*\n`;
      } else if ((type = "url")) {
        resp += `  ${i} - ${getPropVal(page, i)}\n`;
      }
    }
  }
  return resp;
}

//get value of types from page
function getByTypesFromPage(page, types = ["url", "date"]) {
  let resp = getByTypeFromPage(page, "title");

  Object.keys(page.properties)
    .map((p) => ({
      prop: p,
      propVal: getPropVal(page, p),
      typ: getType(page, p),
    }))
    .filter((p) => types.includes(p.typ))
    .filter((p) => p.propVal !== null && p.propVal !== undefined)
    .forEach((p) => (resp += `  ${p.prop} - ${p.propVal}\n`));

  return resp;
}

function isCategoryValue(page, categoryName, value) {
  if (getPropVal(page, categoryName) == value) {
    return true;
  }
  return false;
}
function getAllWithFirstlyTypeFromPage(page, type = "select") {
  let resp = getByTypeFromPage(page, "title");

  Object.keys(page.properties)
    .map((p) => ({
      prop: p,
      propVal: getPropVal(page, p),
      typ: getType(page, p),
    }))
    .filter((p) => p.typ != "title" && p.typ != type && p.typ != "url")
    .filter((p) => p.propVal !== null && p.propVal !== undefined)
    .forEach((p) => (resp += ` ** ${p.prop} - ${p.propVal}\n**`));

  resp += getByTypeFromPage(page, "url");
  const mim = `\__`;
  return resp.replace("_", mim);
}

function getAllFromDatabase(base, type = "select") {
  let rep = "";
  let i = 1;
  for (let elements of base.results) {
    rep += ` ${i}. ` + getAllWithFirstlyTypeFromPage(elements, type) + "\n";
    i++;
  }
  return rep;
}

function getDataByCategoryValue(
  base,
  category_name,
  value,
  types = ["url", "date"]
) {
  let resp = "";
  let i = 1;
  for (let elements of base.results) {
    if (isCategoryValue(elements, category_name, value)) {
      resp += `${i}. ` + getByTypesFromPage(elements, types);
      i++;
    }
  }
  if (resp == "") {
    return "No tasks";
  } else {
    return resp;
  }
}

async function addTask(text, name = "Inbox", id_database = database_gtd) {
  try {
    const res = await notion.pages.create({
      parent: { database_id: id_database },
      properties: {
        Name: { title: [{ text: { content: text } }] },
        Bucket: { select: { name: name } },
      },
    });
    return res;
  } catch (error) {
    return {
      error: "Failed to add user to Mailing List",
    };
  }
}

async function addTaskUrl(
  text,
  urls,
  name = "Inbox",
  id_database = database_gtd
) {
  try {
    const res = await notion.pages.create({
      parent: { database_id: id_database },
      properties: {
        Name: { title: [{ text: { content: text } }] },
        Status: { select: { name: name } },
        URL: { url: urls },
      },
    });
    return res;
  } catch (error) {
    return {
      error: "Failed to add user to Mailing List",
    };
  }
}

let databaseJson = await notion.databases.query({ database_id: database_gtd });

const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply("Hello Yura"));
bot.help((ctx) => ctx.reply(constants._commands));

bot.command("all", async (ctx) => {
  databaseJson = await notion.databases.query({ database_id: database_gtd });
  ctx.replyWithMarkdown(getAllFromDatabase(databaseJson));
});

bot.command("todo", async (ctx) => {
  databaseJson = await notion.databases.query({ database_id: database_gtd });
  ctx.replyWithMarkdown(
    getDataByCategoryValue(databaseJson, "Bucket", "To do")
  );
});

bot.command("buy", async (ctx) => {
  databaseJson = await notion.databases.query({ database_id: database_gtd });
  let reply = getDataByCategoryValue(
    databaseJson,
    "Bucket",
    "List of purchase"
  );
  ctx.replyWithMarkdown(reply);
});

bot.command("transport", async (ctx) => {
  databaseJson = await notion.databases.query({ database_id: database_gtd });
  ctx.replyWithMarkdown(
    getDataByCategoryValue(databaseJson, "Place", "Transport")
  );
});

bot.on("text", async (ctx) => {
  let textik = ctx.message.text.split(" ");
  let url = "";
  let task = "";
  let datab = database_gtd;
  let if_buy = 0;
  for (let el of textik) {
    if (el.startsWith("http")) {
      url = el;
      if (el.includes("youtube.com")) {
        datab = database_video;
      }
    } else {
      task += el + " ";
      if (el.includes("купити")) {
        if_buy = 1;
      }
    }
  }
  // console.log(datab, " ", task, " ", if_buy, " ", url);
  if (url == "") {
    if (if_buy == 1) {
      await addTask(task, "List of purchase", datab);
    } else {
      await addTask(task, "Inbox", datab);
    }
  } else {
    if (if_buy == 1) {
      await addTaskUrl(task, url, "List of purchase", datab);
    } else {
      await addTaskUrl(task, url, "Inbox", datab);
    }
  }
  // } catch (error) {
  //   error = "You catch error";
  //   ctx.reply(error);
  // }
});

bot.launch();
