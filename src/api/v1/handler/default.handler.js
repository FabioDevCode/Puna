
export async function sendHandler(req, res) {
	try {
        console.log("sendHandler");

		// Ici, logique métier à ajouter plus tard
		return res.status(200).json({ success: true });
	} catch (err) {
		return res.status(500).json({ success: false, error: err.message });
	}
}
