import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BLOCK_INSERT_ITEMS } from "@/features/blocks/blockInsertItems";
import { useEditorStore } from "@/stores/editorStore";

export function InsertBlockButton({
  afterBlockId,
  size = "sm",
  label = "Ekle",
}: {
  afterBlockId?: string | null;
  size?: "sm" | "icon";
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {size === "icon" ? (
          <Button size="icon" variant="paper" aria-label="Blok ekle" title="Blok ekle">
            <Plus size={14} />
          </Button>
        ) : (
          <Button size="sm" variant="secondary">
            <Plus size={14} />
            {label}
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-52 overflow-auto">
        {BLOCK_INSERT_ITEMS.map((item) => (
          <DropdownMenuItem
            key={item.type}
            onSelect={() => void useEditorStore.getState().addBlock(item.type, afterBlockId ?? null)}
          >
            {item.label}
            <span className="ml-auto text-[10px] text-[#6b7f9a]">/{item.aliases[0]}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
