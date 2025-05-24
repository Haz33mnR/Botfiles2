require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ApplicationCommandOptionType } = require('discord.js');

// Add error handling for process
process.on('unhandledRejection', (error) => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Store claimed tickets and active giveaways
const claimedTickets = new Map();
const activeGiveaways = new Map();

// Add debug logging
console.log('Starting bot...');
console.log('Node version:', process.version);
console.log('Discord.js version:', require('discord.js').version);

client.once('ready', async () => {
    try {
        console.log(`Logged in as ${client.user.tag}!`);
        console.log('Bot is ready!');
        
        // Register slash commands
        try {
            const giveawayCommand = {
                name: 'giveaway',
                description: 'Create a new giveaway',
                options: [
                    {
                        name: 'title',
                        type: ApplicationCommandOptionType.String,
                        description: 'The title of the giveaway',
                        required: true
                    },
                    {
                        name: 'description',
                        type: ApplicationCommandOptionType.String,
                        description: 'Description of the giveaway',
                        required: true
                    },
                    {
                        name: 'reward',
                        type: ApplicationCommandOptionType.String,
                        description: 'What the winner will receive',
                        required: true
                    },
                    {
                        name: 'image',
                        type: ApplicationCommandOptionType.String,
                        description: 'URL of the image to show in the giveaway (optional)',
                        required: false
                    },
                    {
                        name: 'cohost',
                        type: ApplicationCommandOptionType.User,
                        description: 'Co-host of the giveaway (optional)',
                        required: false
                    }
                ]
            };

            await client.application.commands.set([giveawayCommand]);
            console.log('✅ Slash commands registered globally!');
            
            client.guilds.cache.forEach(guild => {
                console.log(`Bot is in server: ${guild.name} (${guild.id})`);
            });

        } catch (error) {
            console.error('Error registering slash commands:', error);
        }
    } catch (error) {
        console.error('Error in ready event:', error);
    }
});

// ... rest of your existing code ...

// Add error handling for login
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login:', error);
    console.log('Token used:', process.env.DISCORD_TOKEN ? 'Token exists' : 'No token found');
});
