import { useCallback } from "react";

interface RadioGroupOptions<T extends string> {
	value: T;
	values: readonly T[];
	onChange: (next: T) => void;
}

interface RadioOptionProps {
	role: "radio";
	"aria-checked": boolean;
	tabIndex: number;
}

export function useRadioGroup<T extends string>(options: RadioGroupOptions<T>) {
	const { onChange, value, values } = options;

	const getOptionProps = useCallback(
		(option: T): RadioOptionProps => {
			const checked = option === value;
			return {
				"aria-checked": checked,
				role: "radio",
				tabIndex: checked ? 0 : -1,
			};
		},
		[value],
	);

	const onKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const current = e.currentTarget as HTMLElement | null;
			if (!current) return;
			const nodes = Array.from(
				current.querySelectorAll<HTMLElement>('[role="radio"]'),
			);
			if (nodes.length === 0) return;
			const active = document.activeElement as HTMLElement | null;
			let index = nodes.indexOf(active as HTMLElement);
			if (index === -1) {
				const selected = values.indexOf(value);
				index = selected === -1 ? 0 : selected;
			}
			let next: number | null = null;
			if (e.key === "ArrowRight" || e.key === "ArrowDown") next = index + 1;
			else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = index - 1;
			else if (e.key === "Home") next = 0;
			else if (e.key === "End") next = nodes.length - 1;
			else return;
			e.preventDefault();
			const clamped = (next + nodes.length) % nodes.length;
			const nextValue = values[clamped];
			const nextNode = nodes[clamped];
			if (nextValue !== undefined) onChange(nextValue);
			nextNode?.focus();
		},
		[onChange, value, values],
	);

	return { getOptionProps, onKeyDown };
}
