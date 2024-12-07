const {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  InteractionType,
} = require("discord.js");
const express = require("express");
require("dotenv").config();
// Discord Bot Configuration
const TOKEN = process.env.TOKEN;

// Express Server Setup
const app = express();
const PORT = 3001;

// Middleware to parse JSON
app.use(express.json());

let orderId = null;

// Create Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Start Discord Bot
client.once("ready", () => {
  console.log(`Bot logged in as ${client.user.tag}`);
});

// Helper function to get the first available text channel
async function getDefaultTextChannel() {
  const guilds = await client.guilds.fetch();

  for (const [guildId] of guilds) {
    const guild = await client.guilds.fetch(guildId);
    const channels = await guild.channels.fetch();
    const textChannel = channels.find(
      (channel) =>
        channel.type === 0 &&
        channel.permissionsFor(guild.members.me).has("SendMessages")
    );
    if (textChannel) return textChannel;
  }
  return null;
}

app.get("/", (req, res) => {
  res.send("Pong!");
});

// POST route to forward message to a Discord channel
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    if (!body || Object.keys(body).length === 0) {
      return res.status(400).send("Bad Request: Body is empty");
    }

    const channel = await getDefaultTextChannel();
    if (!channel) {
      return res.status(404).send("No accessible text channel found");
    }
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`acceptOrder_${body.id}`) // Include order ID in custom ID
        .setLabel("Accept")
        .setStyle(ButtonStyle.Primary)
    );

    await channel.send({
      content: `\`\`\`markdown\n# New Order\n${body.text}\n\`\`\``,
      components: [row],
    });

    res.status(200).send("Message forwarded to Discord channel");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Handle button interactions
client.on("interactionCreate", async (interaction) => {
  if (interaction.type !== InteractionType.MessageComponent) return;

  if (interaction.customId.startsWith("acceptOrder_")) {
    try {
      await interaction.deferUpdate();
      const orderId = interaction.customId.split("_")[1]; // Extract order ID from custom ID

      // Send API request to specific endpoint
      const response = await fetch(
        "https://food-hamster.vercel.app/api/orders/" + orderId,
        {
          method: "DELETE",
          // headers: { "Content-Type": "application/json" },
          // body: JSON.stringify({ orderId: interaction.message.id }),
        }
      );

      if (response.ok) {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(interaction.customId)
            .setLabel("Accept")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(true) // Disable the button
        );

        await interaction.message.edit({
          components: [row],
        });

        await interaction.followUp({
          content: "Order accepted and API request sent!",
          ephemeral: true,
        });
      } else {
        await interaction.followUp({
          content: "Failed to send API request.",
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error("Error:", error);
      await interaction.followUp({
        content: "An error occurred.",
        ephemeral: true,
      });
    }
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Login the bot
client.login(TOKEN);
