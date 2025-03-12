import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getSessionId, resetAllData, resetSessionId } from "@/lib/utils";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

// Helper function to count all messages in local storage for the current session
const getMessageCountForSession = (): number => {
	try {
		const sessionId = getSessionId();
		if (!sessionId) return 0;

		let totalCount = 0;
		// Check all localStorage keys for chat_messages patterns
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.includes("chat_messages_") && key.includes(sessionId)) {
				const messages = JSON.parse(localStorage.getItem(key) || "[]");
				totalCount += messages.length;
			}
		}
		return totalCount;
	} catch (error) {
		console.error("Error counting messages:", error);
		return 0;
	}
};

const Settings = () => {
	const [sessionId, setSessionId] = useState<string>("");
	const [isResetting, setIsResetting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [messageCount, setMessageCount] = useState<number>(0);
	const { toast } = useToast();

	// Fetch the current session ID when the component mounts
	useEffect(() => {
		fetchSessionId();
		updateMessageCount();
	}, []);

	const fetchSessionId = () => {
		try {
			const currentSessionId = getSessionId();
			if (currentSessionId) {
				setSessionId(currentSessionId);
				setError(null);
			} else {
				throw new Error("No session ID found");
			}
		} catch (err) {
			setError("Unable to fetch session ID");
			console.error(err);
		}
	};

	const updateMessageCount = () => {
		const count = getMessageCountForSession();
		setMessageCount(count);
	};

	const handleResetSessionId = () => {
		setIsResetting(true);
		try {
			resetAllData();
			const newSessionId = resetSessionId();
			setSessionId(newSessionId);
			toast({
				title: "Success",
				description: "Session ID has been reset successfully",
				duration: 3000,
			});
			setError(null);
			// Reset message count after changing session
			setMessageCount(0);
			// Refresh the page
			window.location.reload();
		} catch (err) {
			setError("Failed to reset session ID");
			console.error(err);
		} finally {
			setIsResetting(false);
		}
	};

	return (
		<div className="container mx-auto py-8">
			<h1 className="text-3xl font-bold mb-6">Settings</h1>

			<Card className="mb-6">
				<CardHeader>
					<CardTitle>Session Information</CardTitle>
					<CardDescription>
						View and manage your current session
					</CardDescription>
				</CardHeader>
				<CardContent>
					{error && (
						<div className="mb-4 p-4 border border-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg">
							<div className="flex items-center gap-2 text-red-600 dark:text-red-400">
								<AlertCircle className="h-4 w-4" />
								<p className="font-semibold">Error</p>
							</div>
							<p className="mt-1 text-sm text-red-600 dark:text-red-400">
								{error}
							</p>
						</div>
					)}

					<div className="mb-4">
						<h3 className="text-sm font-medium mb-1">Current Session ID:</h3>
						<code className="bg-muted p-2 rounded block">
							{sessionId || "Loading..."}
						</code>
					</div>

					<div className="mb-4">
						<h3 className="text-sm font-medium mb-1">
							Messages in this session:
						</h3>
						<p className="bg-muted p-2 rounded">
							{messageCount} message{messageCount !== 1 ? "s" : ""} stored
						</p>
						<p className="text-xs text-muted-foreground mt-1">
							Resetting your session ID will start a new chat history.
						</p>
					</div>

					<Button
						onClick={handleResetSessionId}
						disabled={isResetting}
						className="flex items-center"
					>
						{isResetting && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
						Reset Session ID
					</Button>
				</CardContent>
			</Card>
		</div>
	);
};

export default Settings;
