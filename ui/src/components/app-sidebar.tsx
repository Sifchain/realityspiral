import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { apiClient } from "@/lib/api";
import type { UUID } from "@elizaos/core";
import { useQuery } from "@tanstack/react-query";
import { Book, Cog, User, Info } from "lucide-react";
import { NavLink, useLocation } from "react-router";
import ConnectionStatus from "./connection-status";

export function AppSidebar() {
	const location = useLocation();
	const query = useQuery({
		queryKey: ["agents"],
		queryFn: () => apiClient.getAgents(),
		refetchInterval: 5_000,
	});

	const versionQuery = useQuery({
		queryKey: ["version"],
		queryFn: () => apiClient.getVersion(),
	});

	const agents = query?.data?.agents;
	const version = versionQuery.data?.version;
	const url = versionQuery.data?.url;

	return (
		<Sidebar>
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton size="lg" asChild>
							<NavLink to="/">
								<img
									alt="Reality Spiral"
									src="/favicon-32x32.png"
									width="100%"
									height="100%"
									className="size-7"
								/>

								<div className="flex flex-col gap-0.5 leading-none">
									<span className="font-semibold">Reality Spiral</span>
								</div>
							</NavLink>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Agents</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{query?.isPending ? (
								<div>
									{Array.from({ length: 5 }).map((_, index) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
										<SidebarMenuItem key={`skeleton-item-${index}`}>
											<SidebarMenuSkeleton />
										</SidebarMenuItem>
									))}
								</div>
							) : (
								<div>
									{agents?.map((agent: { id: UUID; name: string }) => (
										<SidebarMenuItem key={agent.id}>
											<NavLink to={`/chat/${agent.id}`}>
												<SidebarMenuButton
													isActive={location.pathname.includes(agent.id)}
												>
													<User />
													<span>{agent.name}</span>
												</SidebarMenuButton>
											</NavLink>
										</SidebarMenuItem>
									))}
								</div>
							)}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
			<SidebarFooter>
				<SidebarMenu>
					<SidebarMenuItem>
						<NavLink
							to="https://github.com/Sifchain/realityspiral/blob/main/docs/AI_Agents_UI_Interface_Documentation.md"
							target="_blank"
						>
							<SidebarMenuButton>
								<Book /> Documentation
							</SidebarMenuButton>
						</NavLink>
					</SidebarMenuItem>
					{/* <SidebarMenuItem>
						<SidebarMenuButton disabled>
							<Cog /> Settings
						</SidebarMenuButton>
					</SidebarMenuItem> */}
					<SidebarMenuItem>
						<NavLink to={url ?? ""} target="_blank">
							<SidebarMenuButton disabled>
								<Info /> {version ? `${version}` : "---"}
							</SidebarMenuButton>
						</NavLink>
					</SidebarMenuItem>
					<ConnectionStatus />
				</SidebarMenu>
			</SidebarFooter>
		</Sidebar>
	);
}
