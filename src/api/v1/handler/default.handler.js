
export async function sendHandler(req, res) {
	const { site, form } = req;

	try {
        console.log("sendHandler");

		console.log(site);
		console.log('----------');
		console.log(form);

		// Ici, logique métier à ajouter plus tard
		return res.status(200).json({ success: true });
	} catch (err) {
		return res.status(500).json({ success: false, error: err.message });
	}
}
