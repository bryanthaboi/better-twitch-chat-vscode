const vscode = require('vscode');
const tmi = require('tmi.js');
const fs = require('fs');
const path = require('path');

let chatDocument;
let chatEditor;
let pathX;
let workspace = vscode.workspace;
if (!workspace.workspaceFolders || workspace.workspaceFolders.length === 0) {
    pathX = workspace.rootPath || __dirname;
} else {
    let root;
    if (workspace.workspaceFolders.length === 1) {
        root = workspace.workspaceFolders[0];
    } else {
        root = workspace.getWorkspaceFolder(vscode.Uri.file(__dirname));
    }

    pathX = root.uri.fsPath;
}
const chatFilePath = path.join(pathX || '', 'twitch-chat.ans');
const MAX_LINES = 20;
const config = vscode.workspace.getConfiguration('better-twitch-chat');
const channelName = config.get('username');

const themes = [
    "Dark+ (default dark)",
    "Light+ (default light)",
    "Dark (Visual Studio)",
    "Light (Visual Studio)",
    "High Contrast",
    "Kimbie Dark",
    "Monokai",
    "Monokai Dimmed",
    "Red",
    "Solarized Dark",
    "Solarized Light",
    "Tomorrow Night Blue"
];

function activate(context) {
    console.log('Twitch Chat Extension is now active!');

    let disposable = vscode.commands.registerCommand('extension.openTwitchChat', async function () {
        if (!fs.existsSync(chatFilePath)) {
            fs.writeFileSync(chatFilePath, '', 'utf8'); // Create file if it doesn't exist
        }
        const document = await vscode.workspace.openTextDocument(chatFilePath);
        chatEditor = await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Two });

        chatDocument = chatEditor.document;

        const client = new tmi.Client({
            channels: [`${channelName}`],
        });

        client.connect().catch(console.error);
        await vscode.commands.executeCommand('iliazeus.vscode-ansi.showPretty');
        client.on('message', async (channel, userstate, message, self) => {
            if (self) return;

            const username = userstate['display-name'] || userstate.username;
            const color = getUserColor(userstate);
            const formattedMessage = replaceEmotes(message, userstate.emotes);

            if (message.toLowerCase() === '!theme') {
                const currentTheme = await vscode.workspace.getConfiguration('workbench').get('colorTheme');
                const availableThemes = themes.filter(theme => theme !== currentTheme);
                const randomTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
                await vscode.workspace.getConfiguration().update("workbench.colorTheme", `${randomTheme}`);
                const chatMessage = `${color}${username}\x1b[0m: Changed theme to ${randomTheme}\n`;
                console.log(chatMessage);
                appendToDocument(chatMessage);
            } else {
                const chatMessage = `${color}${username}\x1b[0m: ${formattedMessage}\n`;
                appendToDocument(chatMessage);
            }
        });
    });

    context.subscriptions.push(disposable);
}

function getUserColor(userstate) {
    if (userstate.mod) return '\x1b[32m'; // Green for mods
    if (userstate.subscriber) return '\x1b[33m'; // Yellow for subscribers
    return '\x1b[37m'; // White for regular users
}

function replaceEmotes(message, emotes) {
    if (!emotes) return message;

    let emoteList = [];
    for (let emoteId in emotes) {
        for (let position of emotes[emoteId]) {
            const [start, end] = position.split('-');
            emoteList.push({ id: emoteId, start: parseInt(start), end: parseInt(end) });
        }
    }
    emoteList.sort((a, b) => b.start - a.start);

    let result = message;
    for (let emote of emoteList) {
        result = result.slice(0, emote.start) + '🅱️' + result.slice(emote.end + 1);
    }
    return result;
}

async function appendToDocument(text) {
    let content = fs.readFileSync(chatFilePath, 'utf8');
    let lines = content.split('\n');
    lines.push(text.trim());
    if (lines.length > MAX_LINES) {
        lines = lines.slice(-MAX_LINES);
    }
    fs.writeFileSync(chatFilePath, lines.join('\n') + '\n', 'utf8');

    // Refresh the document
    await vscode.workspace.openTextDocument(chatFilePath);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
};
