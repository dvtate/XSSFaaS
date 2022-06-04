
export default async function () {
	return new Promise((resolve, reject) => {
		console.log(arguments);
		console.log('demo demo demo');
		setTimeout(resolve, 1000);
	});
}
