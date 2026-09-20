export function parseMysqlUrl(value, variableName) {
  if (!value) throw new Error(`${variableName} is required.`);
  const url = new URL(value);
  if (url.protocol !== "mysql:") throw new Error(`${variableName} must use mysql://.`);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!url.hostname || !database) throw new Error(`${variableName} must include host and database name.`);
  return { host: url.hostname, port: url.port || "3306", user: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database };
}

export function mysqlEnvironment(connection) {
  return { ...process.env, MYSQL_PWD: connection.password };
}
