export const getServerUrl = () => {
	const defaultUrl = "http://localhost:3000";
	const envUrl = import.meta.env.VITE_SERVER_URL;

	if (envUrl === "http://localhost:3000") {
		// Get the current hostname and append port 3000
		const hostname = window.location.hostname;
		return `http://${hostname}:3000`;
	}

	return envUrl || defaultUrl;
};
