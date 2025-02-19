import "./index.css";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router";
import { AppSidebar } from "./components/app-sidebar";
import Logs from "./components/ui/logging";
import TemplateManager from "./components/ui/templatesManager";
import { Toaster } from "./components/ui/toaster";
import { TooltipProvider } from "./components/ui/tooltip";
import Chat from "./routes/chat";
import Home from "./routes/home";
import Overview from "./routes/overview";
const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: Number.POSITIVE_INFINITY,
		},
	},
});

function App() {
	return (
		<QueryClientProvider client={queryClient}>
			<div
				className="dark antialiased"
				style={{
					colorScheme: "dark",
				}}
			>
				<BrowserRouter>
					<TooltipProvider delayDuration={0}>
						<SidebarProvider>
							<AppSidebar />
							<SidebarInset>
								<div className="flex flex-1 flex-col gap-4 size-full container">
									<Routes>
										<Route path="/" element={<Home />} />
										<Route path="chat/:agentId" element={<Chat />} />
										<Route path="settings/:agentId" element={<Overview />} />
										<Route path="logs" element={<Logs />} />
										<Route path="templates" element={<TemplateManager />} />
									</Routes>
								</div>
							</SidebarInset>
						</SidebarProvider>
						<Toaster />
					</TooltipProvider>
				</BrowserRouter>
			</div>
		</QueryClientProvider>
	);
}

export default App;
