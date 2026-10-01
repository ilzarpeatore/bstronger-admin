

import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetFooter,
  SheetClose,
} from "src/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "src/components/ui/avatar";
import { Button } from "src/components/ui/button";
import { Icon } from "@iconify-icon/react";

import { cn } from "src/lib/utils";
import { Mailbox } from 'lucide-react';

import { profileDD } from "./data";
import { Link, useNavigate } from "react-router";
import avatar from '@/assets/images/profile/avtar.webp';
import { useAuth } from "@/context/auth-context/AuthContext";

export default function ProfileSheet() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  return (
    <Sheet>
      {/* Trigger Button */}
      <SheetTrigger className="cursor-pointer hover:bg-primary/5 flex items-center justify-center rounded-full h-10 w-10">
        <Avatar className="h-8 w-8">
          <AvatarImage src={avatar} alt="profile" />
          <AvatarFallback>CM</AvatarFallback>
        </Avatar>
      </SheetTrigger>

      {/* Drawer Panel */}
      <SheetContent
        showCloseButton={false}
        side="right"
        className="border-s-0 w-full sm:max-w-80 max-w-60"
      >
        <SheetClose className="absolute top-5 end-5 p-2 hover:bg-primary/5 hover:text-primary rounded-full">
          <Icon icon="tabler:x" width={20} height={20} />
        </SheetClose>
        {/* Top Profile Section */}
        <div className="p-6 py-6">
          <div className="flex flex-col gap-4 justify-center items-center pt-10">
            <Avatar className="h-16 w-16">
              <AvatarImage
                src={avatar}
                alt="Profile"
                width={30}
                height={30}
              />
              <AvatarFallback>CM</AvatarFallback>
            </Avatar>

            <div className="text-center">
              <h6 className="text-lg font-semibold">{user?.name || 'Admin'}</h6>
              <div className="flex items-center gap-2 justify-center">
                <Mailbox
                  size={18} className="text-muted-foreground"
                />
                <span className="text-sm font-normal text-muted-foreground">
                  {user?.email || ''}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Menu List */}
        <div className="border-t  border-border">
          <ul className="flex flex-col gap-2 p-6">
            {profileDD.map((item) => (
              <li key={item.title} className="group">
                <Link
                  to={item.href}
                  className={cn(
                    "flex gap-3 py-2 px-3 rounded-md group-hover:bg-primary/5 text-muted-foreground"
                  )}
                >
                  <item.avatar
                    width={20}
                    height={20}
                    className="group-hover:text-primary"
                  />

                  <div className="flex gap-3 items-center">
                    <h6 className="text-sm group-hover:text-primary">
                      {item.title}
                    </h6>

                    {item.badge && (
                      <span className="h-5 w-6 text-sm flex justify-center items-center text-primary rounded-sm bg-primary/5">
                        4
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <SheetFooter className="px-0 pb-6">
          <div className="border-t border-border w-full">
            <div className="rounded-sm pt-6 flex flex-col justify-center items-center gap-3">

              <Button
                variant="secondary"
                onClick={handleLogout}
                className="text-primary"
              >
                Cerrar sesión
              </Button>
            </div>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
