import { Client } from "@notionhq/client"
import {Telegraf} from 'telegraf';
import dotenv from 'dotenv'
dotenv.config()

import * as constants from './additional.js';




const notion = new Client({ auth: process.env.SECRET_NOTION})
const databaseId = process.env.TEST_DATABASE

function getPropVal(page, propName) {
    const prop = page.properties[propName];
    return propertyGetters[prop?.type]?.(prop);
  };
function getType(page,propName){
    const prop = page.properties[propName];
    return prop?.type;
}

const  propertyGetters = {
    url: (obj)=> obj?.url,
    select: (obj) => obj?.select?.name,
    title: (obj) => obj?.title?.[0]?.plain_text,
    people: (obj) => obj?.people?.map(v => v.name).join(", ") || null,
    date: (obj) => obj?.date?.start,
    email: (obj) => obj?.email,
    phone_number:(obj) => obj?.phone_number,
    checkbox: (obj) => obj?.checkbox,
    number: (obj) => obj?.number,
    multi_select: (obj) => obj.multi_select?.map(v => v.name).join(", ") || null,
    files: (obj)=> null,
}

function getPersonValues(obj){
    let s = '';
    for (const prop of obj?.people){
    s = s + prop.name+' '
    }
    return s
}
function getMultiValues(obj){
    let s = '';
    for (const prop of obj.multi_select){
        s = s+ prop.name + ' ';
    }
    return s;
}

function getTittleFromPage(page){
    let resp = '';
    Object.keys(page.properties)
    .map(p => ({prop: p, propVal: getPropVal(page, p) , typ: getType(page,p) }))
    .filter(p => p.typ == 'title') 
    .forEach(p => resp +=`*${p.prop} - ${p.propVal}*\n`);
    return resp;

}
async function addItem( text, name = "Inbox",id_database = databaseId)
{
    try 
    {
      const res = await notion.pages.create({
        parent: {  database_id: id_database , },
        properties: {
          Name: { title: [ {  text: { content: text}, }, ], },
          Status: { select:  { name: name,},},
                    },
      });
      return res;
    } 
    catch (error) 
    {
      return {
        error: "Failed to add user to Mailing List",
             };
    }
}

async function addItemURL( text,urls, name = "Inbox",id_database = databaseId)
{
    try 
    {
      const res = await notion.pages.create({
        parent: {  database_id: id_database , },
        properties: {
          Name: { title: [ {  text: { content: text}, }, ], },
          Status: { select:  { name: name,},},
          URL: {url: urls},
                    },
      });
      return res;
    } 
    catch (error) 
    {
      return {
        error: "Failed to add user to Mailing List",
             };
    }
}

function getByTypePage(page,type){
    let resp = '';
    Object.keys(page.properties)
    .map(p => ({prop: p, propVal: getPropVal(page, p) , typ: getType(page,p) }))
    .filter(p => p.typ == type) 
    .forEach(p => resp +=`  ${p.prop} - ${p.propVal}\n`);


    return resp; 
}
function getAllWithFirstlyTypeFromPage(page, type = 'select'){
    let resp = getTittleFromPage(page);
    resp += getByTypePage(page,type);

    Object.keys(page.properties)
    .map(p => ({prop: p, propVal: getPropVal(page, p) , typ: getType(page,p) }))
    .filter(p => p.typ != 'title' && p.typ != type && p.typ != 'url')
    .filter(p => p.propVal !== null && p.propVal !== undefined)
    .forEach(p => resp +=`  ${p.prop} - ${p.propVal}\n`); 

    Object.keys(page.properties)
    .map(p => ({prop: p, propVal: getPropVal(page, p) , typ: getType(page,p) }))
    .filter(p => p.typ == 'url')
    .filter(p => p.propVal !== null && p.propVal !== undefined)
    .forEach(p => resp +=`  [${p.prop}](${p.propVal})\n`); 

    return resp; 
}

async function getAllFromDatabase(base,type = 'select'){
    let rep = '';
    for (let elements of base.results){
        rep+= getAllWithFirstlyTypeFromPage(elements,type) + '\n'
    }
    return rep;
}
// check if category of our page is 

function isCategoryValue(page,category_name,value ){
  if (getPropVal(page,category_name)==value){ return true}
  return false
}
async function getDataByCategoryValue (base,category_name,value) {
  let resp = '';  
  for (let elements of base.results){
    if (isCategoryValue(elements,category_name,value)){
      resp += getTittleFromPage(elements)
      resp += getByTypePage(elements,"url");
        }
    }
    return resp;
}

let databaseJson = await notion.databases.query({ database_id: databaseId });
const response = await notion.databases.retrieve({ database_id: databaseId });



const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => ctx.reply("Alibaba"))
bot.help((ctx) => ctx.reply(constants._commands))

bot.command( "all" , async (ctx) => 
      {
        ctx.replyWithMarkdown(await getAllFromDatabase(databaseJson))
      }
)

bot.command( "transport" , async (ctx) => 
      {
        
        ctx.replyWithMarkdown(await getDataByCategoryValue(databaseJson,"Place","Transport"))
      }
)

bot.on('text', async (ctx) => {
  let textik = ctx.message.text;
  if(textik.slice(0,5)=='https'){
    let m = 0;
    for (let i = 0; i < textik.length ; i++){
      if (textik[i] == ' '){
            m = i
            i = textik.length
      }
      addItemURL(textik.slice(m+1,textik.length), textik.slice(0,m) , "Inbox")

    }
  
  }
  else{
    addItem(textik,"Inbox")
  }
  databaseJson = await notion.databases.query({ database_id: databaseId });
})


bot.launch();

