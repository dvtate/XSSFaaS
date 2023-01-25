
/**
 * Default export gets called by web worker thread
 * @param arg {string} additional data provided by the caller
 * @param utils {TaskUtils} relevant utilities
 */
export default async function (arg, utils) {
	return new Promise(resolve => {
		utils.log(`Function called with argument '${arg}'`);
		console.log('demo demo demo');
		setTimeout(resolve, 1000);
	});
}