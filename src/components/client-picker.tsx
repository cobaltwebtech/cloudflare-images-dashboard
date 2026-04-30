import { useQuery } from "@tanstack/react-query";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { clientsQueryOptions } from "@/lib/queries";

const ALL = "__all__";
const NONE = "__none__";

/**
 * Client picker. `value === null` = "no client", `value === undefined` = "all clients".
 */
export function ClientPicker({
	value,
	onChange,
	includeAll = false,
	includeNone = true,
	placeholder = "Select client",
	className,
}: {
	value: string | null | undefined;
	onChange: (id: string | null | undefined) => void;
	includeAll?: boolean;
	includeNone?: boolean;
	placeholder?: string;
	className?: string;
}) {
	const { data: clients = [] } = useQuery(clientsQueryOptions());

	const selectValue = value === undefined ? ALL : value === null ? NONE : value;

	return (
		<Select
			value={selectValue}
			onValueChange={(v) => {
				if (v === ALL) onChange(undefined);
				else if (v === NONE) onChange(null);
				else onChange(v);
			}}
		>
			<SelectTrigger className={className}>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{includeAll ? <SelectItem value={ALL}>All clients</SelectItem> : null}
				{includeNone ? <SelectItem value={NONE}>No client</SelectItem> : null}
				{clients.map((c) => (
					<SelectItem key={c.id} value={c.id}>
						{c.name}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
