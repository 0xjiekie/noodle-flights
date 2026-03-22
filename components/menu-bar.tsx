import { Menu, Luggage, Compass, Plane, Bed, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MenuBarBase } from "./menu-bar-base";

export function MenuBar() {
  const leftContent = (
    <Button variant="ghost" size="icon" className="hover:bg-gray-700/50 rounded-full" aria-label="Main menu">
      <Menu className="!size-5 text-[#E8EAED]" />
    </Button>
  );

  const middleContent = (
    <div className="flex justify-start gap-2 items-center flex-1">
      <a role="link" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 text-[#E8EAED] hover:bg-gray-800/50 hover:text-[#8AB4F8] bg-transparent font-normal text-sm cursor-pointer">
        <Luggage className="h-5 w-5 text-[#8AB4F8]" />
        Travel
      </a>
      <a role="link" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 text-[#E8EAED] hover:bg-gray-800/50 hover:text-[#8AB4F8] bg-transparent font-normal text-sm cursor-pointer">
        <Compass className="h-5 w-5 text-[#8AB4F8]" />
        Explore
      </a>
      <a role="link" className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[#8AB4F8] bg-[#3C485F] hover:bg-[#3f4c64] font-normal text-sm cursor-pointer">
        <Plane className="h-5 w-5 text-[#8AB4F8] fill-[#8AB4F8]" />
        Flights
      </a>
      <a role="link" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 text-[#E8EAED] hover:bg-gray-800/50 hover:text-[#8AB4F8] bg-transparent font-normal text-sm cursor-pointer">
        <Bed className="h-5 w-5 text-[#8AB4F8]" />
        Hotels
      </a>
      <a role="link" className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-600 text-[#E8EAED] hover:bg-gray-800/50 hover:text-[#8AB4F8] bg-transparent font-normal text-sm cursor-pointer">
        <Home className="h-5 w-5 text-[#8AB4F8]" />
        Vacation rentals
      </a>
    </div>
  );

  return <MenuBarBase leftContent={leftContent} middleContent={middleContent} />;
}