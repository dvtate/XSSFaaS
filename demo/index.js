
/**
 * Default export gets called by web worker thread
 */
export default async function (arg, utils) {
	return new Promise(resolve => {
		console.log(arguments);
		console.log('demo demo demo');
		setTimeout(resolve, 1000);
	});
}