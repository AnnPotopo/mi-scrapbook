import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Maximize2, Trash2, MessageSquareText, StickyNote, Calendar, Link as LinkIcon } from 'lucide-react';
import { POSTIT_COLORS } from '../utils';

export default function InteractablePhoto({ photo, updatePhoto, deletePhoto, isEditMode, onBringToFront, onClickView }) {
    const [interaction, setInteraction] = useState(null);
    const [localTransform, setLocalTransform] = useState({
        x: photo.x, y: photo.y, width: photo.width, rotation: photo.rotation
    });

    const startState = useRef(null);
    const containerRef = useRef(null);
    const transformRef = useRef(localTransform);

    useEffect(() => { transformRef.current = localTransform; }, [localTransform]);

    useEffect(() => {
        if (!interaction) {
            setLocalTransform({ x: photo.x, y: photo.y, width: photo.width, rotation: photo.rotation });
        }
    }, [photo.x, photo.y, photo.width, photo.rotation, interaction]);

    const handlePointerDown = (type, e) => {
        if (!isEditMode) return;
        e.stopPropagation();
        e.preventDefault();
        onBringToFront(photo.id);
        setInteraction(type);

        startState.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            x: localTransform.x, y: localTransform.y,
            width: localTransform.width, rotation: localTransform.rotation,
            centerX: 0, centerY: 0
        };

        if (type === 'rotate' && containerRef.current) {
            const rect = containerRef.current.getBoundingClientRect();
            startState.current.centerX = rect.left + rect.width / 2;
            startState.current.centerY = rect.top + rect.height / 2;
        }
    };

    useEffect(() => {
        if (!interaction) return;

        const handlePointerMove = (e) => {
            const s = startState.current;
            const dx = e.clientX - s.mouseX;
            const dy = e.clientY - s.mouseY;

            if (interaction === 'drag') {
                setLocalTransform(prev => ({ ...prev, x: s.x + dx, y: s.y + dy }));
            }
            else if (interaction === 'resize') {
                const moveAvg = (dx + dy) / 2;
                const newWidth = Math.max(80, s.width + moveAvg);
                setLocalTransform(prev => ({ ...prev, width: newWidth }));
            }
            else if (interaction === 'rotate') {
                const currentAngle = Math.atan2(e.clientY - s.centerY, e.clientX - s.centerX);
                const startAngle = Math.atan2(s.mouseY - s.centerY, s.mouseX - s.centerX);
                const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
                setLocalTransform(prev => ({ ...prev, rotation: s.rotation + angleDiff }));
            }
        };

        const handlePointerUp = () => {
            setInteraction(null);
            updatePhoto(photo.id, transformRef.current);
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [interaction, photo.id, updatePhoto]);

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', left: `${localTransform.x}px`, top: `${localTransform.y}px`,
                width: `${localTransform.width}px`, transform: `rotate(${localTransform.rotation}deg)`,
                zIndex: photo.zIndex || 1, touchAction: 'none'
            }}
            className={`group ${isEditMode ? 'cursor-move' : 'cursor-pointer'}`}
            onPointerDown={(e) => {
                if (isEditMode) handlePointerDown('drag', e);
                else {
                    if (photo.type === 'link' && photo.url) window.open(photo.url, '_blank', 'noopener,noreferrer');
                    else if (!photo.type || photo.type === 'image') onClickView(photo);
                }
            }}
        >
            {(!photo.type || photo.type === 'image') && (
                <div className={`bg-[#faf9f5] p-3 pb-12 rounded-sm border relative transition-all duration-300 ${isEditMode && interaction === 'drag' ? 'border-amber-300 shadow-2xl scale-105' : 'border-stone-200 shadow-xl group-hover:shadow-2xl'}`}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/40 backdrop-blur-md border border-white/40 shadow-sm rounded-sm transform rotate-2 z-10 opacity-80" style={{ backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.6))' }}></div>
                    <img src={photo.src} alt="Álbum" className="w-full h-auto object-cover pointer-events-none rounded-sm border border-stone-200/60 shadow-inner" draggable="false" />
                    {!isEditMode && photo.description && (
                        <div className="absolute bottom-3 left-0 w-full flex justify-center text-stone-400">
                            <div className="flex items-center gap-1.5 bg-stone-100/80 px-3 py-1 rounded-full text-xs font-serif italic backdrop-blur-sm">
                                <MessageSquareText size={14} /> Leer recuerdo
                            </div>
                        </div>
                    )}
                </div>
            )}

            {photo.type === 'postit' && (
                <div className={`${POSTIT_COLORS[photo.color || 'yellow']} p-6 shadow-md font-serif text-xl border-t border-l relative transition-all duration-300 ${isEditMode && interaction === 'drag' ? 'scale-105 shadow-xl' : 'hover:shadow-lg'}`} style={{ minHeight: '150px' }}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-5 bg-white/30 backdrop-blur-sm shadow-sm rounded-sm transform -rotate-2 z-10 opacity-70"></div>
                    {photo.content}
                </div>
            )}

            {photo.type === 'date' && (
                <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-full shadow-md border-2 border-stone-800 text-stone-800 font-bold font-mono whitespace-nowrap flex items-center justify-center gap-2">
                    <Calendar size={18} /> {photo.content}
                </div>
            )}

            {photo.type === 'link' && (
                <div className="bg-blue-500 text-white px-6 py-4 rounded-2xl shadow-lg font-bold text-center flex items-center justify-center gap-3 hover:bg-blue-600 transition-colors border-2 border-white">
                    <LinkIcon size={20} /> <span className="truncate">{photo.content}</span>
                </div>
            )}

            {photo.type === 'emoji' && (
                <div className="text-[100px] leading-none drop-shadow-xl select-none flex items-center justify-center">{photo.content}</div>
            )}

            {isEditMode && (
                <>
                    <div onPointerDown={(e) => handlePointerDown('rotate', e)} className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-grab text-blue-500 hover:bg-blue-50 hover:scale-110 transition-all"><RotateCw size={18} strokeWidth={2.5} /></div>
                    <div onPointerDown={(e) => handlePointerDown('resize', e)} className="absolute -bottom-5 -right-5 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-nwse-resize text-emerald-500 hover:bg-emerald-50 hover:scale-110 transition-all"><Maximize2 size={18} strokeWidth={2.5} /></div>
                    <div onPointerDown={(e) => { e.stopPropagation(); deletePhoto(photo.id); }} className="absolute -top-5 -right-5 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-pointer text-rose-500 hover:bg-rose-50 hover:scale-110 transition-all opacity-0 group-hover:opacity-100"><Trash2 size={18} strokeWidth={2.5} /></div>
                    <div className="absolute inset-0 border-2 border-dashed border-blue-400/0 group-hover:border-blue-400/60 pointer-events-none rounded-sm transition-colors"></div>
                </>
            )}
        </div>
    );
}