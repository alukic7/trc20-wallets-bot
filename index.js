require('dotenv').config()
const TelegramApi = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;;
const API_KEY = process.env.TRONSCAN_API_KEY;
const axios = require('axios');
const bot = new TelegramApi(token, {polling: true});

const allowedUsers = [977385108, 7540947010, 7529522452, 7649862662];
const wallets = new Map();
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
    if (!isUserAllowed(msg)) return;
    if (!addingMode) return;

    const chatId = msg.chat.id;
    const text = msg.text.trim();

    if (text.startsWith('/')) return;

    const parts = text.split(/\s+/);
    if (parts.length < 2) {
        bot.sendMessage(chatId, "⚠️ Please provide both the wallet name and the TRC20 wallet address in the format: <walletName> <address>");
        return;
    }

    const [walletName, address] = parts;

    if (!address.startsWith('T')) {
        bot.sendMessage(chatId, "⚠️ Invalid TRC20 wallet address. Please try again.");
        return;
    }

    if (wallets.has(walletName)) {
        bot.sendMessage(chatId, "🔄 Wallet name already exists.");
    } else {
        wallets.set(walletName, address);
        bot.sendMessage(chatId, `✅ Wallet added: ${walletName} → ${address}`);
    }
});

bot.onText(/\/list/, (msg) => {
    if (!isUserAllowed(msg)) return;
    const chatId = msg.chat.id;

    const addresses = Array.from(wallets, ([walletName, address]) => `${walletName}: ${address}`);

    if (addresses.length === 0) {
        bot.sendMessage(chatId, "🚫 No wallet addresses stored. Use /add to add some.");
    } else {
        bot.sendMessage(chatId, `📋 Stored wallet addresses:\n\n${addresses.join("\n")}`);
    }
});

bot.onText(/\/remove (.+)/, (msg, match) => {
    if (!isUserAllowed(msg)) return;
    const chatId = msg.chat.id;
    const walletNameToRemove = match[1].trim();

    if (wallets.has(walletNameToRemove)) {
        wallets.delete(walletNameToRemove);
        bot.sendMessage(chatId, `❌ Removed wallet: ${walletNameToRemove}`);
    } else {
        bot.sendMessage(chatId, "⚠️ Wallet not found in the stored wallets.");
    }
});

bot.onText(/\/balance/, async (msg) => {
    if (!isUserAllowed(msg)) return;
    const chatId = msg.chat.id;

    const walletsArray = Array.from(wallets.entries());
    if (walletsArray.length === 0) {
        bot.sendMessage(chatId, "🚫 No wallet addresses stored. Use /add to add some.");
        return;
    }

    bot.sendMessage(chatId, "⏳ Fetching balances, please wait...");

    let totalBalance = 0;
    let message = ``;

    const numberToEmoji = (num) => {
        const emojiNumbers = ['0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
        return num.toString().split('').map(digit => emojiNumbers[parseInt(digit)]).join('');
    };

    try {
        for (let i = 0; i < walletsArray.length; i++) {
            const [walletName, address] = walletsArray[i];
            const currBalance = await fetchBalance(address);
            totalBalance += currBalance;
            message += `${numberToEmoji(i + 1)} ${walletName} (${address}): ${currBalance.toFixed(0)}\n\n`;
        }
        bot.sendMessage(chatId, `${message}\n💰 Total balance in USDT is: ${totalBalance.toFixed(0)}`);
    } catch (error) {
        bot.sendMessage(chatId, "⚠️ Error retrieving balances.");
    }
});