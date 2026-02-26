import { type ReactNode } from "react";
interface CardProps {
    className?: string;
    title?: string;
    onClick?: () => void;
    children: ReactNode;
    variant?: 'default' | 'glass';

}

const Card = (props: CardProps) => {
    return (
        <div className={`rounded-2xl p-6 shadow-lg transition-all duration-300
        ${props.variant === 'glass' 
            ? 'bg-white/5 backdrop-blur-lg border border-white/10' 
            : 'bg-neutral-800 border border-neutral-700'} ${props.className}`}>
            {props.title && (
                <div className='mb-4 border-b border-neutral-700/50 pb-3'>
                    <h3 className="text-xl font-bold text-neutral-100"> {props.title}</h3>
                </div>
            )}
            <div className="text-neutral-300">
                {props.children}
            </div>
        </div>
    )
};

export default Card; 