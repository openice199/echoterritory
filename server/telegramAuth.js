const crypto = require("crypto");

// Проверка Telegram.WebApp.initData по официальному алгоритму:
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
// secret = HMAC_SHA256("WebAppData", botToken)
// data_check_string = все поля кроме hash, отсортированные "key=value" через \n
// ok, если HMAC_SHA256(data_check_string, secret) в hex совпадает с полем hash
function validateInitData(initData, botToken) {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return null;
  params.delete("hash");

  const pairs = [];
  for (const [key, value] of params.entries()) pairs.push(`${key}=${value}`);
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return null;

  // initData не старше 24 часов — защита от повторного использования старых данных
  const authDate = parseInt(params.get("auth_date"), 10);
  if (authDate && Date.now() / 1000 - authDate > 86400) return null;

  const userRaw = params.get("user");
  if (!userRaw) return null;
  try {
    const user = JSON.parse(userRaw);
    return { id: String(user.id), firstName: user.first_name, username: user.username };
  } catch {
    return null;
  }
}

module.exports = { validateInitData };
