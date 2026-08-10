const db = require("./db");

// Метки видов работы для текста уведомления — держи в синхроне с ключами
// ACTIVE_JOB_DEFS в web/app.js.
const JOB_LABELS = {
  fishing: "Рыбалка", cooking: "Готовка", gather: "Сбор одуванчиков", brew: "Варка эликсира",
  seaweed: "Сбор водорослей", potionBrew: "Приготовление препарата", scrap: "Сбор лома",
  forge: "Ковка оружия", gem: "Добыча камней", set: "Огранка", fabric: "Сбор ткани", sew: "Пошив",
};

async function sendTelegramMessage(botToken, chatId, text) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("telegram sendMessage failed:", e.message);
  }
}

// Раз в 30с проверяем, не завершилась ли у кого-то длительная работа, пока
// приложение было закрыто, и шлём уведомление через бота — клиент сам применит
// награду при следующем открытии (resolveActiveJobOnLoad в app.js).
function startJobNotifySweep(botToken) {
  if (!botToken) return;
  setInterval(async () => {
    try {
      const pending = await db.listPendingJobNotifications(Date.now());
      for (const row of pending) {
        if (!/^\d+$/.test(row.telegram_id)) continue; // dev_* тестовые id — не настоящий Telegram chat
        const label = JOB_LABELS[row.job.kind] || "Работа";
        await sendTelegramMessage(botToken, row.telegram_id, `✅ ${label} завершена! Загляните в игру — ресурсы уже готовы.`);
        await db.markJobNotified(row.telegram_id);
      }
    } catch (e) {
      console.error("job notify sweep failed:", e.message);
    }
  }, 30000);
}

module.exports = { startJobNotifySweep };
