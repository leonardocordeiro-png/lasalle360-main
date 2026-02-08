"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Icon } from "@iconify/react";

interface MenuItem {
  icon: string;
  label: string;
  action: string;
  iconClass?: string;
  badge?: { text: string; className: string };
  rightIcon?: string;
  showAvatar?: boolean;
}

interface UserDropdownProps {
  user: {
    name: string;
    email: string;
    avatar?: string;
    initials: string;
    isAdmin?: boolean;
  };
  onAction?: (action: string) => void;
  onLogout?: () => void;
}

export const UserDropdown = ({ 
  user,
  onAction = () => {},
  onLogout = () => {},
}: UserDropdownProps) => {
  
  const profileItems: MenuItem[] = [
    { icon: "solar:user-circle-line-duotone", label: "Meu Perfil", action: "profile" },
    { icon: "solar:bell-line-duotone", label: "Notificações", action: "notifications" },
  ];

  const adminItems: MenuItem[] = user.isAdmin ? [
    { 
      icon: "solar:shield-star-bold-duotone", 
      label: "Painel Admin", 
      action: "admin",
      iconClass: "text-amber-500",
      badge: { text: "Admin", className: "bg-amber-500 text-white text-[10px]" }
    },
    { icon: "solar:users-group-rounded-line-duotone", label: "Gerenciar Usuários", action: "users" },
  ] : [];

  const supportItems: MenuItem[] = [
    { 
      icon: "solar:question-circle-line-duotone", 
      label: "Ajuda e Suporte", 
      action: "help",
      rightIcon: "solar:square-top-down-line-duotone"
    },
    { 
      icon: "solar:info-circle-line-duotone", 
      label: "Sobre o Sistema", 
      action: "about",
    },
  ];

  const renderMenuItem = (item: MenuItem, index: number) => (
    <DropdownMenuItem 
      key={index}
      className={cn(
        item.badge || item.showAvatar || item.rightIcon ? "justify-between" : "", 
        "p-2.5 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors"
      )}
      onClick={() => onAction(item.action)}
    >
      <span className="flex items-center gap-2 font-medium">
        <Icon
          icon={item.icon}
          className={cn("size-5", item.iconClass || "text-muted-foreground")}
        />
        {item.label}
      </span>
      {item.badge && (
        <Badge className={item.badge.className}>
          {item.badge.text}
        </Badge>
      )}
      {item.rightIcon && (
        <Icon
          icon={item.rightIcon}
          className="size-4 text-muted-foreground"
        />
      )}
      {item.showAvatar && (
        <Avatar className="cursor-pointer size-6 shadow border border-white dark:border-gray-700">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback>{user.initials}</AvatarFallback>
        </Avatar>
      )}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Avatar className="cursor-pointer size-10 sm:size-11 ring-2 ring-white/20 shadow-lg hover:ring-white/40 transition-all">
          <AvatarImage src={user.avatar} alt={user.name} />
          <AvatarFallback className="bg-white/20 text-primary-foreground font-semibold text-sm">
            {user.initials}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent 
        className="w-[300px] rounded-2xl bg-background/95 backdrop-blur-xl p-0 shadow-2xl border border-border/50" 
        align="end"
        sideOffset={8}
      >
        {/* Header com informações do usuário */}
        <section className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-t-2xl p-1">
          <div className="flex items-center gap-3 p-3">
            <Avatar className="size-12 border-2 border-white shadow-lg">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm text-foreground truncate">{user.name}</h3>
              <p className="text-muted-foreground text-xs truncate">{user.email}</p>
            </div>
            {user.isAdmin && (
              <Badge className="bg-amber-500 text-white border-0 text-[10px] px-2">
                <Icon icon="solar:shield-star-bold" className="size-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
        </section>

        {/* Menu Items */}
        <section className="p-1">
          {/* Perfil */}
          <DropdownMenuGroup>
            {profileItems.map(renderMenuItem)}
          </DropdownMenuGroup>

          {/* Admin (se for admin) */}
          {adminItems.length > 0 && (
            <>
              <DropdownMenuSeparator className="my-1" />
              <DropdownMenuGroup>
                <p className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Administração
                </p>
                {adminItems.map(renderMenuItem)}
              </DropdownMenuGroup>
            </>
          )}

          {/* Suporte */}
          <DropdownMenuSeparator className="my-1" />
          <DropdownMenuGroup>
            {supportItems.map(renderMenuItem)}
          </DropdownMenuGroup>
        </section>

        {/* Logout */}
        <section className="p-1 border-t border-border/50 bg-muted/30 rounded-b-2xl">
          <DropdownMenuItem 
            className="p-2.5 rounded-lg cursor-pointer hover:bg-destructive/10 text-destructive transition-colors"
            onClick={onLogout}
          >
            <span className="flex items-center gap-2 font-medium">
              <Icon
                icon="solar:logout-2-bold-duotone"
                className="size-5"
              />
              Sair da Conta
            </span>
          </DropdownMenuItem>
        </section>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserDropdown;