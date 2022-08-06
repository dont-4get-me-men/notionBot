import { Client } from "@notionhq/client";
import { Markup, Telegraf } from "telegraf";

import dotenv from "dotenv";

dotenv.config();

const notion = new Client({ auth: process.env.SECRET_NOTION });
//const database_test = process.env.TEST_DATABASE;
const database_video = process.env.DATABASE_VIDEO;
const database_gtd = process.env.DATABASE_GTD;

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}

const propertyGetters = {
  url: (obj) => obj?.url,
  select: (obj) => obj?.select?.name,
  title: (obj) => obj?.title?.[0]?.plain_text,
  people: (obj) => obj?.people?.map((v) => v.name).join(", ") || "",
  date: (obj) => obj?.date?.start,
  email: (obj) => obj?.email,
  phone_number: (obj) => obj?.phone_number,
  checkbox: (obj) => obj?.checkbox,
  number: (obj) => obj?.number,
  multi_select: (obj) => obj.multi_select?.map((v) => v.name).join(", ") || "",
  files: (obj) => "",
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
    .filter(
      (p) => p.propVal !== null && p.propVal !== undefined && p.propVal !== ""
    )
    .forEach((p) => (resp += `  ${p.prop} - ${p.propVal}\n`));

  const mim = `\\_`;
  return resp.replaceAll("_", mim);
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
  const mim = `\\_`;
  return resp.replaceAll("_", mim);
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
  name_status = "Inbox",
  id_database = database_gtd
) {
  try {
    const res = await notion.pages.create({
      parent: { database_id: id_database },
      properties: {
        Name: { title: [{ text: { content: text } }] },
        Bucket: { select: { name: name_status } },
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

const commands = `
  start - Restart bot
  all - Get all Database
  transport - All task from database where Place = Transport 
  buy - List of purchase that i need to buy
  fun - random movie to watch
  todo - get all todos in base
  video - get random video 
`;
// bot.setMyCommands([
//   { command: "/start", description: "Restart bot" },
//   { command: "/all", description: "Get all Database" },
//   { command: "/buy", description: "List of purchase that i need to buy" },
//   { command: "/todo", description: "What I need to do" },
//   { command: "/fun", description: "What I need to do" },
// ]);

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

bot.command("fun", async (ctx) => {
  ctx.reply(
    "Choose what are you going to watch",
    Markup.inlineKeyboard([
      [Markup.button.callback("Movies", "mov")],
      [Markup.button.callback("Cartoons TV show", "car")],
      [Markup.button.callback("Morning", "mor")],
      [Markup.button.callback("TV-shows", "tv")],
    ])
  );
});
bot.on("callback_query", async (msg) => {
  let data = msg.update.callback_query.data;
  if (data == "mov") {
    let films = await notion.databases.query({
      database_id: process.env.DATABASE_FILMS,
    });
    let cartoons = await notion.databases.query({
      database_id: process.env.DATABASE_CARTOONS,
    });
    let a = Object.values(films.results.concat(cartoons.results))
      .map((p) => ({
        check: getPropVal(p, "Watched"),
        title: getPropVal(p, "Name"),
      }))
      .filter((p) => p.check == false);
    msg.reply(a[getRandomInt(a.length)].title);
  } else if (data == "car") {
    let anime = await notion.databases.query({
      database_id: process.env.DATABASE_ANIME,
    });
    let cartoons_tv = await notion.databases.query({
      database_id: process.env.DATABASE_CARTOONS_TV_SHOWS,
    });
    let a = Object.values(anime.results)
      .map((p) => ({
        check: getPropVal(p, "Watched"),
        title: getPropVal(p, "Name"),
      }))
      .filter((p) => p.check == false);
    let b = Object.values(cartoons_tv.results)
      .map((p) => ({
        check: getPropVal(p, "Watched"),
        title: getPropVal(p, "Name"),
        tags: getPropVal(p, "Tags"),
      }))
      .filter((p) => p.check == false && !p.tags.includes("Morning"));
    let c = a.concat(b);
    msg.reply(c[getRandomInt(c.length)].title);
  } else if (data == "mor") {
    let cartoons_tv = await notion.databases.query({
      database_id: process.env.DATABASE_CARTOONS_TV_SHOWS,
    });
    let b = Object.values(cartoons_tv.results)
      .map((p) => ({
        check: getPropVal(p, "Watched"),
        title: getPropVal(p, "Name"),
        tags: getPropVal(p, "Tags"),
      }))
      .filter((p) => p.check == false && p.tags.includes("Morning"));
    msg.reply(b[getRandomInt(b.length)].title);
  } else if (data == "tv") {
    let tv = await notion.databases.query({
      database_id: process.env.DATABASE_TV_SHOWS,
    });
    let a = Object.values(tv.results)
      .map((p) => ({
        check: getPropVal(p, "Watched"),
        title: getPropVal(p, "Name"),
      }))
      .filter((p) => p.check == false);
    msg.reply(a[getRandomInt(a.length)].title);
  }
});
bot.command("video", async (ctx) => {
  let videos = await notion.databases.query({
    database_id: process.env.DATABASE_VIDEO,
  });
  let b = Object.values(videos.results)
    .map((p) => ({
      check: getPropVal(p, "Watched"),
      title: getPropVal(p, "Name"),
      url: getPropVal(p, "URL"),
    }))
    .filter((p) => p.check == false);
  let rand = b[getRandomInt(b.length)];
  let stri = ` **${rand.title}**\n ${rand.url}`;
  ctx.replyWithMarkdown(stri);
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
      if (el.toLowerCase().includes("купити")) {
        if_buy = 1;
      }
    }
  }
  console.log(datab, " ", task, " ", if_buy, " ", url);
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
