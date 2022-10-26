module.exports = {
  apps : [{
    name: "xss api server",
    script: "./dist/index.js",
    env: {
	    DEBUG: "xss:api:*"
    },
  }]
}
