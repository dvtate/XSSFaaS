module.exports = {
  apps : [{
    name: "xss router",
    script: "./dist/index.js",
    env: {
      DEBUG: "xss:rtr:*"
    },	  
  }]
}
