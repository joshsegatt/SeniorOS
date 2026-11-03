// Entry point of the deployed app (`npm start`).
process.env.APP_ENV ??= 'production';

const { config, appEnv } = await import('./config.js');
const { createServer } = await import('./http.js');

const port = Number(process.env.PORT ?? 3000);
createServer().listen(port, () => {
  console.log(`${config.shop.name} (${appEnv}, ${config.shop.timezone}) listening on ${port}`);
});
