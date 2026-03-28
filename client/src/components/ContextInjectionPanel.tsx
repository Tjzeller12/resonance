import { useState } from 'react';

export interface ContextField {
    key: string;
    label: string;
    placeholder?: string;
    maxLength: number;
}

interface ContextInjectionPanelProps {
    title: string;
    subtitle?: string;
    fields: ContextField[];
    quickChips?: string[];
    chipTargetField?: string;
    onLaunch: (context: Record<string, string>) => void;
    onCancel: () => void;
}

export default function ContextInjectionPanel({
    title,
    subtitle,
    fields,
    quickChips,
    chipTargetField,
    onLaunch,
    onCancel,
}: ContextInjectionPanelProps) {
    const [values, setValues] = useState<Record<string, string>>(
        Object.fromEntries(fields.map((f) => [f.key, '']))
    );

    const handleChange = (key: string, value: string, maxLength: number) => {
        if (value.length <= maxLength) {
            setValues((prev) => ({ ...prev, [key]: value }));
        }
    };

    const handleChipClick = (chip: string) => {
        if (!chipTargetField) return;
        const field = fields.find((f) => f.key === chipTargetField);
        if (!field) return;

        setValues((prev) => {
            const current = prev[chipTargetField] || '';
            const separator = current.length > 0 ? ', ' : '';
            const next = current + separator + chip;
            return next.length <= field.maxLength
                ? { ...prev, [chipTargetField]: next }
                : prev;
        });
    };

    const hasContent = Object.values(values).some((v) => v.trim().length > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="w-full max-w-xl bg-neutral-900 border border-neutral-700/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="px-6 pt-6 pb-4 border-b border-neutral-800">
                    <h2 className="text-2xl font-bold text-white">{title}</h2>
                    {subtitle && (
                        <p className="text-sm text-neutral-400 mt-1">{subtitle}</p>
                    )}
                </div>

                {/* Fields */}
                <div className="px-6 py-5 flex flex-col gap-5">
                    {fields.map((field) => (
                        <div key={field.key} className="flex flex-col gap-2">
                            <label className="text-sm font-semibold text-neutral-300 tracking-wide">
                                {field.label}
                            </label>
                            <textarea
                                value={values[field.key]}
                                onChange={(e) =>
                                    handleChange(field.key, e.target.value, field.maxLength)
                                }
                                placeholder={field.placeholder}
                                rows={3}
                                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-4 py-3 text-white text-sm placeholder-neutral-500 focus:outline-none focus:border-blue-500/60 focus:ring-1 focus:ring-blue-500/30 resize-none transition-colors"
                            />
                            <div className="text-xs text-neutral-500 text-right tabular-nums">
                                <span
                                    className={
                                        (values[field.key]?.length || 0) >= field.maxLength * 0.9
                                            ? 'text-amber-400'
                                            : ''
                                    }
                                >
                                    {values[field.key]?.length || 0}
                                </span>
                                /{field.maxLength}
                            </div>
                        </div>
                    ))}

                    {/* Quick Chips */}
                    {quickChips && quickChips.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                                Quick Tags
                            </span>
                            <div className="flex flex-wrap gap-2">
                                {quickChips.map((chip) => (
                                    <button
                                        key={chip}
                                        onClick={() => handleChipClick(chip)}
                                        className="px-3 py-1.5 text-xs font-medium rounded-full bg-neutral-800 border border-neutral-700 text-neutral-300 hover:bg-blue-500/20 hover:border-blue-500/40 hover:text-blue-300 transition-all duration-200 cursor-pointer"
                                    >
                                        {chip}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-neutral-800 flex items-center justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2.5 text-sm font-medium text-neutral-400 hover:text-white bg-neutral-800 hover:bg-neutral-700 rounded-xl transition-colors cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onLaunch(values)}
                        disabled={!hasContent}
                        className={`px-6 py-2.5 text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer ${
                            hasContent
                                ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                        }`}
                    >
                        Start Simulation →
                    </button>
                </div>
            </div>
        </div>
    );
}
