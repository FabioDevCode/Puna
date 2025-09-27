export default {
	capitalizeFirstLetter: (str) => str.charAt(0).toUpperCase() + str.slice(1),
	generateCode: (length = 10) => {
		const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
		let code = '';
		for (let i = 0; i < length; i++) {
			code += chars[Math.floor(Math.random() * chars.length)];
		}
		return code;
	}
};
