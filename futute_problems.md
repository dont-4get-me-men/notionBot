## Markdown Problem{https://github.com/irazasyed/telegram-bot-sdk/issues/493}

function toEscapeMSg(str: string): string {
return str
.replace(/_/gi, "\\_")
.replace(/-/gi, "\\-")
.replace("~", "\\~")
.replace(/`/gi, "\\`")
.replace(/\./g, "\\.");
}
