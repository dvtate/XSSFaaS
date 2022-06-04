const axios = require('axios');

function sendTask() {
	console.log('sent task');
	axios.post('http://xssaas.com/api/work/task/f493dd96-e3c1-11ec-929f-e250eaa37355', new Date().toUTCString())
	.then(() => setTimeout(sendTask, 100))
	.catch(console.error);
}
sendTask();

