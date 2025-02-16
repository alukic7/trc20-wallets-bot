require('dotenv').config()
const TelegramApi = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;;
const API_KEY = process.env.TRONSCAN_API_KEY;
const axios = require('axios');
const bot = new TelegramApi(token, {polling: true});

const allowedUsers = [977385108, 7540947010];
const wallets = new Set();
let addingMode = false;

bot.setMyCommands([
    { command: "/start", description: "Start the bot and see options" },
    { command: "/add", description: "Add a TRC20 wallet address" },
    { command: "/list", description: "Show all wallet addresses" },
    { command: "/remove", description: "Remove a wallet address" },
    { command: "/balance", description: "Get total balance of all stored wallets" },
]).then(() => {
    console.log("✅ Command menu has been set.");
});

async function fetchBalance(address) {
    const url = `https://apilist.tronscanapi.com/api/account/token_asset_overview?address=${address}`;
    try {
        const response = await axios.get(url, {
            headers: {
                'TRON-PRO-API-KEY': API_KEY,
            }
        });
        const totalAssetInUsd = response.data?.totalAssetInUsd;
        if (totalAssetInUsd !== undefined) {
            return totalAssetInUsd;
        } else {
            return 0;
        }
    } catch (error) {
        console.log(error);
    }
}

function isUserAllowed(msg) {
    return allowedUsers.includes(msg.from.id);
}

bot.onText(/\/start/, (msg) => {
    if (!isUserAllowed(msg)) {
        bot.sendMessage(msg.chat.id, "🚫 Access denied. You are not authorized to use this bot.");
        return;
    }
    bot.sendMessage(msg.chat.id, `Hello ${msg.from.first_name}! 😊
This bot tracks TRC20 wallet balances.

📌 Commands:
• /add - Add wallet addresses (shared globally)
• /remove - Paste address to remove it from the list
• /list - List all wallets
• /balance - Retrieve total balance across all wallets in USDT

Type /add to begin adding addresses.`);
});

bot.onText(/\/add/, (msg) => {
    if (!isUserAllowed(msg)) {
        bot.sendMessage(msg.chat.id, "🚫 Access denied.");
        return;
    }
    addingMode = true;
    bot.sendMessage(msg.chat.id, "Send TRC20 wallet addresses one by one. Type /done when finished.");
});

bot.onText(/\/done/, (msg) => {
    if (!isUserAllowed(msg)) return;
    if (!addingMode) {
        bot.sendMessage(msg.chat.id, "⚠️ You are not in address-adding mode. Use /add to start.");
        return;
    }
    addingMode = false;
    bot.sendMessage(msg.chat.id, "✅ Finished adding addresses.");
});

bot.on('message', (msg) => {
    if(!isUserAllowed(msg)) return;
    if(!addingMode) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text.startsWith('/')) return;

    if (!text.startsWith('T')) {
        bot.sendMessage(chatId, "⚠️ Invalid TRC20 wallet address. Please try again.");
        return;
    }

    if (wallets.has(text)) {
        bot.sendMessage(chatId, "🔄 Address already added.");
    } else {
        wallets.add(text);
        bot.sendMessage(chatId, `✅ Address added: ${text}`);
    }
})

bot.onText(/\/list/, (msg) => {
    if (!isUserAllowed(msg)) return;
    const addresses = Array.from(wallets);

    if (addresses.length === 0) {
        bot.sendMessage(msg.chat.id, "🚫 No wallet addresses stored. Use /add to add some.");
    } else {
        bot.sendMessage(msg.chat.id, `📋 Stored wallet addresses:\n\n${addresses.join("\n\n")}`);
    }
});

bot.onText(/\/remove (.+)/, (msg, match) => {
    if (!isUserAllowed(msg)) return;
    const addressToRemove = match[1].trim();

    if (wallets.has(addressToRemove)) {
        wallets.delete(addressToRemove);
        bot.sendMessage(msg.chat.id, `❌ Removed address: ${addressToRemove}`);
    } else {
        bot.sendMessage(msg.chat.id, "⚠️ Address not found in the stored wallets.");
    }
});

bot.onText(/\/balance/, async (msg) => {
    if (!isUserAllowed(msg)) return;

    const addresses = Array.from(wallets);
    if (addresses.length === 0) {
        bot.sendMessage(msg.chat.id, "🚫 No wallet addresses stored. Use /add to add some.");
        return;
    }

    bot.sendMessage(msg.chat.id, "⏳ Fetching balances, please wait...");

    let totalBalance = 0;

    try {
        for (const address of addresses) {
            const currBalance =  await fetchBalance(address);
            totalBalance += currBalance;
            bot.sendMessage(msg.chat.id, `${address}: ${currBalance}\n\n`);
        }
        bot.sendMessage(msg.chat.id, `💰 Total balance in USDT is: ${totalBalance.toFixed(2)}`);

    } catch (error) {
        bot.sendMessage(msg.chat.id, "⚠️ Error retrieving balances.");
    }
});