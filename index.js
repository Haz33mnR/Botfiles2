require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, ChannelType, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ApplicationCommandOptionType } = require('discord.js');

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

// Auto-shutdown variables
let lastActivity = Date.now();
const INACTIVE_TIMEOUT = 42 * 60 * 60 * 1000; // 42 hours in milliseconds

// Function to update activity
function updateActivity() {
    lastActivity = Date.now();
}

// Check for inactivity every hour
setInterval(() => {
    const timeSinceLastActivity = Date.now() - lastActivity;
    if (timeSinceLastActivity >= INACTIVE_TIMEOUT) {
        console.log('Bot inactive for 42 hours. Shutting down...');
        process.exit(0);
    }
}, 60 * 60 * 1000); // Check every hour

client.on('messageCreate', async message => {
    updateActivity();
    // Ignore messages from bots
    if (message.author.bot) return;

    // Handle verification panel command
    if (message.content === '!verifypanel') {
        // Check if user has admin permissions
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('You do not have permission to use this command!');
        }

        const verifyEmbed = new EmbedBuilder()
            .setTitle('✅ Server Verification')
            .setDescription('Welcome to the server! Please click the button below to verify yourself and gain access to the server.')
            .setColor('#00ff00')
            .setTimestamp()
            .setFooter({ text: 'Click the button below to verify!' });

        const verifyButton = new ButtonBuilder()
            .setCustomId('verify_user')
            .setLabel('Verify')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success);

        const row = new ActionRowBuilder()
            .addComponents(verifyButton);

        await message.channel.send({
            embeds: [verifyEmbed],
            components: [row]
        });

        // Delete the command message
        await message.delete();
    }

    // Handle !announce command
    if (message.content.startsWith('!announce')) {
        // Check if user has admin permissions
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('You do not have permission to use this command!');
        }

        // Get the announcement content
        const args = message.content.slice('!announce'.length).trim();
        
        if (!args) {
            return message.reply('Please provide an announcement message! Usage: !announce <message>');
        }

        // Create an embed for the announcement
        const announceEmbed = new EmbedBuilder()
            .setTitle('📢 Announcement')
            .setDescription(args)
            .setColor('#FF9300')
            .setTimestamp()
            .setFooter({ text: `Announced by ${message.author.tag}` });

        try {
            // Send the mention first, then the embed
            if (args.includes('@everyone') || args.includes('@here')) {
                await message.channel.send({ 
                    content: args.includes('@everyone') ? '@everyone' : '@here',
                    embeds: [announceEmbed],
                    allowedMentions: { parse: ['everyone'] }
                });
            } else {
                await message.channel.send({ 
                    content: '@everyone',
                    embeds: [announceEmbed],
                    allowedMentions: { parse: ['everyone'] }
                });
            }
            // Delete the command message
            await message.delete();
        } catch (error) {
            console.error('Error sending announcement:', error);
            message.reply('There was an error sending the announcement.');
        }
    }

    if (message.content === '!ticketpanel') {
        if (!message.member.permissions.has('ADMINISTRATOR')) {
            return message.reply('You do not have permission to use this command.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 AquaHaven Support Center')
            .setDescription('Need assistance? We\'re here to help!')
            .addFields(
                { name: '📝 How to get support:', value: 
                    '• Click the button below to create a private ticket\n' +
                    '• Describe your issue in detail\n' +
                    '• A staff member will respond as soon as possible' },
                { name: '⏰ Support hours:', value: 
                    'Monday to Friday: 9 AM - 6 PM\n' +
                    'Weekend: Limited support' }
            )
            .setColor('#0099ff')
            .setFooter({ text: 'Please only create a ticket if you have a genuine issue • Abuse of the ticket system may result in restrictions' });

        const button = new ButtonBuilder()
            .setCustomId('create_ticket')
            .setLabel('Create Support Ticket')
            .setEmoji('🎫')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder()
            .addComponents(button);

        await message.channel.send({
            embeds: [embed],
            components: [row]
        });
    }
});

function createTicketButtons(isClosed = false) {
    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('claim_ticket')
            .setLabel('Claim')
            .setEmoji('👋')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId('add_user')
            .setLabel('Add User')
            .setEmoji('➕')
            .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
            .setCustomId('remove_user')
            .setLabel('Remove User')
            .setEmoji('➖')
            .setStyle(ButtonStyle.Danger)
    );

    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(isClosed ? 'reopen_ticket' : 'close_ticket')
            .setLabel(isClosed ? 'Reopen' : 'Close')
            .setEmoji(isClosed ? '🔓' : '🔒')
            .setStyle(isClosed ? ButtonStyle.Success : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('delete_ticket')
            .setLabel('Delete')
            .setEmoji('🗑️')
            .setStyle(ButtonStyle.Danger)
    );

    return [row1, row2];
}

client.on('interactionCreate', async interaction => {
    updateActivity();
    if (interaction.isCommand()) {
        if (interaction.commandName === 'giveaway') {
            // Check if user has permission
            if (!interaction.member.permissions.has('MANAGE_MESSAGES')) {
                return interaction.reply({ content: 'You do not have permission to create giveaways!', ephemeral: true });
            }

            const title = interaction.options.getString('title');
            const description = interaction.options.getString('description');
            const reward = interaction.options.getString('reward');
            const imageUrl = interaction.options.getString('image');
            const host = interaction.member;
            const coHost = interaction.options.getUser('cohost');

            const giveawayEmbed = new EmbedBuilder()
                .setTitle(`🎉 ${title}`)
                .setDescription(description)
                .addFields(
                    { name: '🎁 Reward', value: reward, inline: false },
                    { name: '👑 Hosted by', value: `${host}`, inline: true },
                    { name: '🤝 Co-Host', value: coHost ? `${coHost}` : 'None', inline: true },
                    { name: '📝 Entries', value: '0', inline: false }
                )
                .setColor('#FF1493')
                .setTimestamp()
                .setFooter({ text: 'Click the button below to enter!' });

            // Add image if URL is provided
            if (imageUrl) {
                giveawayEmbed.setImage(imageUrl);
            }

            const enterButton = new ButtonBuilder()
                .setCustomId('enter_giveaway')
                .setLabel('Enter Giveaway')
                .setEmoji('🎉')
                .setStyle(ButtonStyle.Primary);

            const endButton = new ButtonBuilder()
                .setCustomId('end_giveaway')
                .setLabel('End Giveaway')
                .setEmoji('⚠️')
                .setStyle(ButtonStyle.Danger);

            const row = new ActionRowBuilder()
                .addComponents(enterButton, endButton);

            const giveawayMsg = await interaction.channel.send({
                embeds: [giveawayEmbed],
                components: [row]
            });

            // Store giveaway data
            activeGiveaways.set(giveawayMsg.id, {
                title,
                description,
                reward,
                host: host.id,
                coHost: coHost ? coHost.id : null,
                entries: new Set(),
                message: giveawayMsg
            });

            await interaction.reply({ content: 'Giveaway created!', ephemeral: true });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'create_ticket') {
            try {
                const ticketCategory = interaction.guild.channels.cache.get(process.env.TICKET_CATEGORY_ID);
                if (!ticketCategory) {
                    return interaction.reply({ content: 'Ticket category not found!', ephemeral: true });
                }

                const existingTicket = interaction.guild.channels.cache.find(
                    channel => channel.name === `ticket-${interaction.user.username.toLowerCase()}`
                );

                if (existingTicket) {
                    return interaction.reply({
                        content: `You already have a ticket open at ${existingTicket}`,
                        ephemeral: true
                    });
                }

                const ticketChannel = await interaction.guild.channels.create({
                    name: `ticket-${interaction.user.username}`,
                    type: ChannelType.GuildText,
                    parent: ticketCategory,
                    permissionOverwrites: [
                        {
                            id: interaction.guild.id,
                            deny: [PermissionFlagsBits.ViewChannel],
                        },
                        {
                            id: interaction.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                        {
                            id: client.user.id,
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages],
                        },
                    ],
                });

                const ticketEmbed = new EmbedBuilder()
                    .setTitle('Support Ticket Created')
                    .setDescription(`Welcome ${interaction.user}!\n\nA staff member will be with you shortly. Please describe your issue in detail while you wait.`)
                    .setColor('#00ff00')
                    .setTimestamp();

                await ticketChannel.send({
                    embeds: [ticketEmbed],
                    components: createTicketButtons()
                });

                await interaction.reply({
                    content: `Your ticket has been created: ${ticketChannel}`,
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error creating ticket:', error);
                await interaction.reply({
                    content: 'There was an error creating your ticket!',
                    ephemeral: true
                });
            }
        }

        // Claim ticket
        if (interaction.customId === 'claim_ticket') {
            if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
                return interaction.reply({ content: 'You do not have permission to claim tickets!', ephemeral: true });
            }

            const ticketId = interaction.channel.id;
            if (claimedTickets.has(ticketId)) {
                return interaction.reply({ content: 'This ticket is already claimed!', ephemeral: true });
            }

            claimedTickets.set(ticketId, interaction.user.id);
            await interaction.reply(`Ticket claimed by ${interaction.user}`);
        }

        // Add user to ticket
        if (interaction.customId === 'add_user') {
            if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
                return interaction.reply({ content: 'You do not have permission to add users!', ephemeral: true });
            }

            await interaction.reply({ 
                content: 'Please mention the user you want to add to the ticket',
                ephemeral: true 
            });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            try {
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
                const targetUser = collected.first().mentions.users.first();
                
                await interaction.channel.permissionOverwrites.edit(targetUser, {
                    ViewChannel: true,
                    SendMessages: true
                });

                await interaction.followUp(`Added ${targetUser} to the ticket`);
            } catch (error) {
                await interaction.followUp({ content: 'No user mentioned within 30 seconds, operation cancelled.', ephemeral: true });
            }
        }

        // Remove user from ticket
        if (interaction.customId === 'remove_user') {
            if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
                return interaction.reply({ content: 'You do not have permission to remove users!', ephemeral: true });
            }

            await interaction.reply({ 
                content: 'Please mention the user you want to remove from the ticket',
                ephemeral: true 
            });

            const filter = m => m.author.id === interaction.user.id && m.mentions.users.size > 0;
            try {
                const collected = await interaction.channel.awaitMessages({ filter, max: 1, time: 30000 });
                const targetUser = collected.first().mentions.users.first();
                
                await interaction.channel.permissionOverwrites.edit(targetUser, {
                    ViewChannel: false,
                    SendMessages: false
                });

                await interaction.followUp(`Removed ${targetUser} from the ticket`);
            } catch (error) {
                await interaction.followUp({ content: 'No user mentioned within 30 seconds, operation cancelled.', ephemeral: true });
            }
        }

        // Close ticket
        if (interaction.customId === 'close_ticket') {
            if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
                return interaction.reply({ content: 'You do not have permission to close tickets!', ephemeral: true });
            }

            await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
                ViewChannel: false
            });

            const closedEmbed = new EmbedBuilder()
                .setTitle('Ticket Closed')
                .setDescription('This ticket has been closed. Staff members can reopen it if needed.')
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.message.edit({
                embeds: [closedEmbed],
                components: createTicketButtons(true)
            });

            await interaction.reply('Ticket closed');
        }

        // Reopen ticket
        if (interaction.customId === 'reopen_ticket') {
            if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
                return interaction.reply({ content: 'You do not have permission to reopen tickets!', ephemeral: true });
            }

            const ticketUser = interaction.channel.name.split('-')[1];
            const user = interaction.guild.members.cache.find(member => member.user.username.toLowerCase() === ticketUser);

            if (user) {
                await interaction.channel.permissionOverwrites.edit(user, {
                    ViewChannel: true,
                    SendMessages: true
                });
            }

            const reopenedEmbed = new EmbedBuilder()
                .setTitle('Ticket Reopened')
                .setDescription('This ticket has been reopened.')
                .setColor('#00ff00')
                .setTimestamp();

            await interaction.message.edit({
                embeds: [reopenedEmbed],
                components: createTicketButtons(false)
            });

            await interaction.reply('Ticket reopened');
        }

        // Delete ticket
        if (interaction.customId === 'delete_ticket') {
            if (!interaction.member.permissions.has('MANAGE_CHANNELS')) {
                return interaction.reply({ content: 'You do not have permission to delete tickets!', ephemeral: true });
            }

            const deleteEmbed = new EmbedBuilder()
                .setTitle('Ticket Deletion')
                .setDescription('This ticket will be deleted in 5 seconds...')
                .setColor('#ff0000')
                .setTimestamp();

            await interaction.reply({ embeds: [deleteEmbed] });
            
            setTimeout(async () => {
                try {
                    await interaction.channel.delete();
                } catch (error) {
                    console.error('Error deleting ticket:', error);
                }
            }, 5000);
        }

        if (interaction.customId === 'enter_giveaway') {
            const giveaway = activeGiveaways.get(interaction.message.id);
            if (!giveaway) {
                return interaction.reply({ content: 'This giveaway no longer exists!', ephemeral: true });
            }

            if (giveaway.entries.has(interaction.user.id)) {
                return interaction.reply({ content: 'You have already entered this giveaway!', ephemeral: true });
            }

            giveaway.entries.add(interaction.user.id);

            // Update embed
            const updatedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
                .spliceFields(3, 1, { name: '📝 Entries', value: giveaway.entries.size.toString(), inline: false });

            await interaction.message.edit({ embeds: [updatedEmbed] });
            await interaction.reply({ content: 'You have entered the giveaway! Good luck! 🍀', ephemeral: true });
        }

        if (interaction.customId === 'end_giveaway') {
            const giveaway = activeGiveaways.get(interaction.message.id);
            if (!giveaway) {
                return interaction.reply({ content: 'This giveaway no longer exists!', ephemeral: true });
            }

            // Check if user is host or co-host
            if (interaction.user.id !== giveaway.host && interaction.user.id !== giveaway.coHost) {
                return interaction.reply({ content: 'Only the host or co-host can end this giveaway!', ephemeral: true });
            }

            if (giveaway.entries.size === 0) {
                await interaction.reply({ content: 'No one entered the giveaway!', ephemeral: true });
                return;
            }

            // Pick a winner
            const entriesArray = Array.from(giveaway.entries);
            const winnerID = entriesArray[Math.floor(Math.random() * entriesArray.length)];
            const winner = await interaction.guild.members.fetch(winnerID);

            const winnerEmbed = new EmbedBuilder()
                .setTitle(`🎉 Giveaway Ended: ${giveaway.title}`)
                .setDescription(`**Winner:** ${winner}\n\n**Prize:** ${giveaway.reward}`)
                .setColor('#00FF00')
                .setTimestamp()
                .setFooter({ text: 'Congratulations to the winner!' });

            await interaction.message.edit({ embeds: [winnerEmbed], components: [] });
            await interaction.channel.send(`🎊 Congratulations ${winner}! You won **${giveaway.reward}**! 🎊`);
            
            // Remove from active giveaways
            activeGiveaways.delete(interaction.message.id);
            await interaction.reply({ content: 'Giveaway ended successfully!', ephemeral: true });
        }

        // Handle verify button click
        if (interaction.customId === 'verify_user') {
            try {
                // Check if role exists, if not create it
                let verifiedRole = interaction.guild.roles.cache.find(role => role.name === 'Verified');
                if (!verifiedRole) {
                    verifiedRole = await interaction.guild.roles.create({
                        name: 'Verified',
                        color: '#00ff00',
                        reason: 'Role for verified users'
                    });
                }

                // Add role to user
                await interaction.member.roles.add(verifiedRole);

                // Send confirmation
                await interaction.reply({
                    content: '✅ You have been verified! Welcome to the server!',
                    ephemeral: true
                });

            } catch (error) {
                console.error('Error in verification:', error);
                await interaction.reply({
                    content: 'There was an error during verification. Please contact an administrator.',
                    ephemeral: true
                });
            }
        }
    }
});

client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    console.log('Bot will automatically shut down after 42 hours of inactivity');
    updateActivity();

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

        // Register commands globally
        await client.application.commands.set([giveawayCommand]);
        console.log('✅ Slash commands registered globally!');
        
        // Log all servers the bot is in
        client.guilds.cache.forEach(guild => {
            console.log(`Bot is in server: ${guild.name}`);
        });

    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

// Handle shutdown
process.on('SIGINT', () => {
    console.log('Bot shutting down...');
    process.exit(0);
});

client.login(process.env.DISCORD_TOKEN); 