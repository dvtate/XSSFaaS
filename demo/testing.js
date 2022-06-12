/// This file is used to stress test the backend, please ignore it



const axios = require('axios');

function sendTask() {
	console.log('sent task');
	axios.post(
		'http://xssaas.com/api/work/task/892ea9d3-e8db-11ec-92e1-e353f8df75ae?key=F%2FRFscw%2BGn%2FWszbw2DLQs7neFLa6XA7v',
		{ date: new Date().toUTCString(), user: 'Tate' },
	)
	.then(() => setTimeout(sendTask, 100))
	.catch(console.error);
}
sendTask();