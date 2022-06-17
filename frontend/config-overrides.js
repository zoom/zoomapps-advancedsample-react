module.exports = {
  devServer: (configFunction) => {
    return (proxy, allowedHost) => {
      const config = configFunction(proxy, allowedHost);
      config.headers = {
        "access-control-allow-origin": "*",
      };
      return config;
    };
  },
};
