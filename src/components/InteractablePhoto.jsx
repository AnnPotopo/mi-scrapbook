import React, { useState, useEffect, useRef } from 'react';
import { RotateCw, Maximize2, Trash2, MessageSquareText, Calendar, Link as LinkIcon, MapPin, Edit2, Music, Hash, Lock } from 'lucide-react';

export const getLazoPath = (pts, isSmooth) => {
    if (!pts || pts.length === 0) return "";
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
    if (!isSmooth || pts.length < 3) return `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`;

    let d = `M ${pts[0].x},${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
        const p0 = i > 0 ? pts[i - 1] : pts[0];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = i !== pts.length - 2 ? pts[i + 2] : p2;

        const cp1x = p1.x + (p2.x - p0.x) * 0.2;
        const cp1y = p1.y + (p2.y - p0.y) * 0.2;
        const cp2x = p2.x - (p3.x - p1.x) * 0.2;
        const cp2y = p2.y - (p3.y - p1.y) * 0.2;

        d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
    }
    return d;
};

export default function InteractablePhoto({ photo, updatePhoto, deletePhoto, isEditMode, isSelected, onSelect, onBringToFront, onClickView, onEditClick, zoom = 1, isTourPlaying = false, isDrawingMode = false }) {
    const [interaction, setInteraction] = useState(null);
    const [localTransform, setLocalTransform] = useState({
        x: photo.x, y: photo.y, width: photo.width, rotation: photo.rotation
    });

    const [localPoints, setLocalPoints] = useState(photo.points || []);

    const startState = useRef(null);
    const containerRef = useRef(null);
    const transformRef = useRef(localTransform);

    useEffect(() => { transformRef.current = localTransform; }, [localTransform]);

    useEffect(() => {
        if (!interaction) {
            setLocalTransform({ x: photo.x, y: photo.y, width: photo.width, rotation: photo.rotation });
            setLocalPoints(photo.points || []);
        }
    }, [photo, interaction]);

    const handlePointerDown = (type, e, pointIndex = null) => {
        if (!isEditMode || photo.isLocked) return;
        e.stopPropagation();
        e.preventDefault();

        onBringToFront(photo.id);
        if (onSelect) onSelect();

        setInteraction(type);

        startState.current = {
            mouseX: e.clientX, mouseY: e.clientY,
            x: localTransform.x, y: localTransform.y,
            width: localTransform.width, rotation: localTransform.rotation,
            centerX: 0, centerY: 0,
            pointIndex: pointIndex,
            originalPoint: pointIndex !== null && localPoints.length > 0 ? { ...localPoints[pointIndex] } : null
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
            const dx = (e.clientX - s.mouseX) / zoom;
            const dy = (e.clientY - s.mouseY) / zoom;

            if (interaction === 'drag') {
                setLocalTransform(prev => ({ ...prev, x: s.x + dx, y: s.y + dy }));
            }
            else if (interaction === 'resize') {
                const moveAvg = (dx + dy) / 2;
                const newWidth = Math.max(50, s.width + moveAvg);
                setLocalTransform(prev => ({ ...prev, width: newWidth }));
            }
            else if (interaction === 'rotate') {
                const currentAngle = Math.atan2(e.clientY - s.centerY, e.clientX - s.centerX);
                const startAngle = Math.atan2(s.mouseY - s.centerY, s.mouseX - s.centerX);
                const angleDiff = (currentAngle - startAngle) * (180 / Math.PI);
                setLocalTransform(prev => ({ ...prev, rotation: s.rotation + angleDiff }));
            }
            else if (interaction === 'dragPoint' && s.pointIndex !== null) {
                const scale = localTransform.width / (photo.baseWidth || photo.width || 1);
                const angleRad = -localTransform.rotation * (Math.PI / 180);

                const rotDx = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
                const rotDy = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

                const newX = s.originalPoint.x + (rotDx / scale);
                const newY = s.originalPoint.y + (rotDy / scale);

                const newPoints = [...localPoints];
                newPoints[s.pointIndex] = { x: newX, y: newY };
                setLocalPoints(newPoints);
            }
        };

        const handlePointerUp = () => {
            setInteraction(null);
            if (interaction === 'dragPoint') {
                updatePhoto(photo.id, { points: localPoints });
            } else {
                updatePhoto(photo.id, transformRef.current);
            }
        };

        window.addEventListener('pointermove', handlePointerMove);
        window.addEventListener('pointerup', handlePointerUp);

        return () => {
            window.removeEventListener('pointermove', handlePointerMove);
            window.removeEventListener('pointerup', handlePointerUp);
        };
    }, [interaction, photo.id, updatePhoto, localPoints, localTransform, photo.baseWidth, photo.width, zoom]);

    const dynamicStyle = {
        backgroundColor: photo.bgColor || '#ffffff',
        borderColor: photo.borderColor || '#e5e7eb',
        color: photo.textColor || '#1f2937',
        fontWeight: photo.isBold ? 'bold' : 'normal',
        fontStyle: photo.isItalic ? 'italic' : 'normal',
        borderWidth: photo.borderColor ? '2px' : '0px',
        borderStyle: 'solid'
    };

    const isLinkable = (photo.type === 'link' || photo.type === 'location' || photo.type === 'music') && photo.url;
    const frameColor = photo.frameColor || '#faf9f5';
    const tapeStyle = photo.tapeStyle || 'top';
    const tapeGradient = 'linear-gradient(to right, rgba(255,255,255,0.1), rgba(255,255,255,0.6))';

    // MAGIA DE BLOQUEO: Si el usuario está dibujando un lazo O si el objeto está bloqueado en modo edición,
    // se aplica 'none' a los eventos del ratón. Esto hace que los clics atraviesen este objeto como un fantasma.
    const interactionEvents = (isDrawingMode || (photo.isLocked && isEditMode)) ? 'none' : 'auto';

    return (
        <div
            ref={containerRef}
            style={{
                position: 'absolute', left: `${localTransform.x}px`, top: `${localTransform.y}px`,
                width: `${localTransform.width}px`, transform: `rotate(${localTransform.rotation}deg)`,
                zIndex: photo.zIndex || 1, touchAction: 'none',
                pointerEvents: interactionEvents
            }}
            className={`group ${isEditMode && !photo.isLocked && !isDrawingMode ? 'cursor-move' : ''} ${!isEditMode && isLinkable ? 'cursor-pointer hover:scale-105 active:scale-95 transition-all duration-200' : (!isEditMode ? 'cursor-pointer hover:scale-[1.02] transition-transform duration-300' : '')} ${photo.isLocked && isEditMode ? 'opacity-90' : ''}`}
            onPointerDown={(e) => {
                if (photo.isLocked || isDrawingMode) return;
                if (isEditMode) handlePointerDown('drag', e);
                else {
                    if (isLinkable) window.open(photo.url, '_blank', 'noopener,noreferrer');
                    else if (!photo.type || photo.type === 'image') onClickView(photo);
                }
            }}
        >
            {isEditMode && photo.isLocked && (
                <div className="absolute -top-3 -right-3 bg-rose-500 text-white rounded-full p-1.5 shadow-lg z-[100] print:hidden pointer-events-none">
                    <Lock size={12} strokeWidth={3} />
                </div>
            )}

            {/* FOTOGRAFÍA */}
            {(!photo.type || photo.type === 'image') && (
                <div style={{ backgroundColor: frameColor }} className={`p-3 pb-12 rounded-sm border relative transition-all duration-300 ${isEditMode && interaction === 'drag' ? 'border-amber-300 shadow-2xl scale-105' : 'border-stone-200 shadow-xl group-hover:shadow-2xl'}`}>
                    {tapeStyle === 'top' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-16 h-6 bg-white/40 backdrop-blur-md border border-white/40 shadow-sm rounded-sm transform rotate-2 z-10 opacity-80 print:opacity-100" style={{ backgroundImage: tapeGradient }}></div>}
                    {tapeStyle === 'corners' && (
                        <>
                            <div className="absolute -top-2 -left-3 w-10 h-5 bg-white/40 backdrop-blur-md shadow-sm rounded-sm transform -rotate-45 z-10 opacity-80 print:opacity-100" style={{ backgroundImage: tapeGradient }}></div>
                            <div className="absolute -top-2 -right-3 w-10 h-5 bg-white/40 backdrop-blur-md shadow-sm rounded-sm transform rotate-45 z-10 opacity-80 print:opacity-100" style={{ backgroundImage: tapeGradient }}></div>
                            <div className="absolute -bottom-2 -left-3 w-10 h-5 bg-white/40 backdrop-blur-md shadow-sm rounded-sm transform rotate-45 z-10 opacity-80 print:opacity-100" style={{ backgroundImage: tapeGradient }}></div>
                            <div className="absolute -bottom-2 -right-3 w-10 h-5 bg-white/40 backdrop-blur-md shadow-sm rounded-sm transform -rotate-45 z-10 opacity-80 print:opacity-100" style={{ backgroundImage: tapeGradient }}></div>
                        </>
                    )}
                    <img src={photo.src} alt="Álbum" className="w-full h-auto object-cover pointer-events-none rounded-sm border border-black/10 shadow-inner" draggable="false" />
                    {!isEditMode && photo.description && (
                        <div className="absolute bottom-3 left-0 w-full flex justify-center text-stone-500 print:hidden pointer-events-none">
                            <div className="flex items-center gap-1.5 bg-white/80 px-3 py-1 rounded-full text-xs font-serif italic backdrop-blur-sm shadow-sm border border-stone-200/50">
                                <MessageSquareText size={14} /> Leer recuerdo
                            </div>
                        </div>
                    )}
                </div>
            )}

            {photo.type === 'drawing' && (
                <div className="relative">
                    <img src={photo.src} alt="Dibujo Libre" className="w-full h-auto drop-shadow-md pointer-events-none select-none" draggable="false" />
                </div>
            )}

            {/* LAZO Y LAZO GUÍA */}
            {(photo.type === 'lazo' || photo.type === 'lazo_guia') && (
                <div className="relative w-full h-full overflow-visible">
                    {isEditMode && photo.type === 'lazo_guia' && (
                        <div className="absolute -top-6 -left-6 bg-blue-600 text-white font-black text-lg w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white z-50 print:hidden pointer-events-none">
                            {photo.tourOrder || 1}
                        </div>
                    )}

                    <svg viewBox={`0 0 ${photo.baseWidth || photo.width} ${photo.baseHeight || photo.height}`} width="100%" height="100%" className={`overflow-visible drop-shadow-md pointer-events-none ${photo.type === 'lazo_guia' && !isEditMode && !photo.tourVisible ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}`}>
                        <defs>
                            <marker id={`arrow-head-${photo.id}`} markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto-start-reverse">
                                <path d="M 0 0 L 6 3 L 0 6 z" fill={photo.color || (photo.type === 'lazo_guia' ? '#3b82f6' : '#1f2937')} />
                            </marker>
                        </defs>
                        <path
                            d={getLazoPath(localPoints, photo.isSmooth)}
                            fill="none"
                            stroke={photo.color || (photo.type === 'lazo_guia' ? '#3b82f6' : '#1f2937')}
                            strokeWidth={photo.thickness || (photo.texture === 'estambre' ? 8 : photo.texture === 'hilo' ? 3 : 4)}
                            strokeDasharray={photo.type === 'lazo_guia' ? '12 12' : (photo.texture === 'punteada' ? '8 8' : photo.texture === 'estambre' ? '2 8' : 'none')}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            markerEnd={(photo.texture === 'flecha' || photo.texture === 'bidireccional' || photo.type === 'lazo_guia') ? `url(#arrow-head-${photo.id})` : ''}
                            markerStart={photo.texture === 'bidireccional' ? `url(#arrow-head-${photo.id})` : ''}
                            className="pointer-events-none"
                        />
                        {isEditMode && isSelected && !photo.isLocked && !isDrawingMode && localPoints.map((p, index) => (
                            <g key={index} className="pointer-events-auto">
                                <circle
                                    cx={p.x} cy={p.y} r={10 * ((photo.baseWidth || photo.width) / localTransform.width)}
                                    fill="#3b82f6" stroke="white" strokeWidth={2 * ((photo.baseWidth || photo.width) / localTransform.width)}
                                    className="cursor-crosshair hover:fill-blue-400 opacity-90 transition-colors print:hidden"
                                    onPointerDown={(e) => handlePointerDown('dragPoint', e, index)}
                                />
                                <text x={p.x + 12} y={p.y - 12} fill="#3b82f6" fontSize={14 * ((photo.baseWidth || photo.width) / localTransform.width)} fontWeight="bold" className="pointer-events-none select-none print:hidden">{index + 1}</text>
                            </g>
                        ))}
                    </svg>
                </div>
            )}

            {photo.type === 'postit' && (
                <div style={{ ...dynamicStyle, minHeight: '150px' }} className={`p-6 shadow-md font-serif text-xl border-t border-l relative transition-all duration-300 ${isEditMode && interaction === 'drag' ? 'scale-105 shadow-xl' : 'hover:shadow-lg'}`}>
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-14 h-5 bg-white/30 backdrop-blur-sm shadow-sm rounded-sm transform -rotate-2 z-10 opacity-70 print:opacity-100"></div>
                    {photo.content}
                </div>
            )}

            {photo.type === 'date' && (
                <div style={dynamicStyle} className="px-6 py-3 rounded-full shadow-md whitespace-nowrap flex items-center justify-center gap-2">
                    <Calendar size={18} /> {photo.content}
                </div>
            )}

            {photo.type === 'link' && (
                <div style={dynamicStyle} className="px-6 py-4 rounded-2xl shadow-lg text-center flex items-center justify-center gap-3">
                    <LinkIcon size={20} /> <span className="truncate">{photo.content}</span>
                </div>
            )}

            {photo.type === 'location' && (
                <div style={dynamicStyle} className="px-6 py-3 rounded-full shadow-lg whitespace-nowrap flex items-center justify-center gap-2">
                    <MapPin size={18} /> {photo.content}
                </div>
            )}

            {photo.type === 'music' && (
                <div style={dynamicStyle} className="px-6 py-4 rounded-2xl shadow-lg text-center flex items-center justify-center gap-3">
                    <Music size={20} /> <span className="truncate font-bold">{photo.content}</span>
                </div>
            )}

            {photo.type === 'counter' && (
                <div style={dynamicStyle} className="px-6 py-4 rounded-3xl shadow-lg flex items-center justify-center gap-4 border-b-4">
                    <span className="text-4xl font-black">{photo.url}</span>
                    <span className="text-sm uppercase tracking-widest font-bold opacity-80 leading-tight w-min text-left">{photo.content}</span>
                </div>
            )}

            {photo.type === 'emoji' && (
                <div style={{ fontSize: `${localTransform.width * 0.8}px` }} className="leading-none drop-shadow-xl select-none flex items-center justify-center">
                    {photo.content}
                </div>
            )}

            {photo.type === 'animated' && (
                <div style={{ fontSize: `${localTransform.width * 0.8}px` }} className={`leading-none drop-shadow-xl select-none flex items-center justify-center transition-all duration-700 ${isTourPlaying ? (photo.animationStyle || 'animate-bounce') : ''}`}>
                    {photo.content}
                </div>
            )}

            {/* CONTROLES DE EDICIÓN FLOTANTES */}
            {isEditMode && isSelected && !photo.isLocked && !isDrawingMode && (
                <div className="print:hidden pointer-events-auto">
                    <div onPointerDown={(e) => handlePointerDown('rotate', e)} className="absolute -top-12 left-1/2 -translate-x-1/2 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-grab text-blue-500 hover:bg-blue-50 hover:scale-110 active:scale-95 transition-all z-50"><RotateCw size={18} strokeWidth={2.5} /></div>

                    {(!photo.type || photo.type === 'image' || ['postit', 'date', 'link', 'location', 'lazo', 'lazo_guia', 'drawing', 'music', 'counter', 'animated'].includes(photo.type)) && (
                        <div onPointerDown={(e) => { e.stopPropagation(); onEditClick(photo); }} className="absolute -top-5 -left-5 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-pointer text-indigo-500 hover:bg-indigo-50 hover:scale-110 active:scale-95 transition-all z-50"><Edit2 size={18} strokeWidth={2.5} /></div>
                    )}

                    <div onPointerDown={(e) => handlePointerDown('resize', e)} className="absolute -bottom-5 -right-5 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-nwse-resize text-emerald-500 hover:bg-emerald-50 hover:scale-110 active:scale-95 transition-all z-50"><Maximize2 size={18} strokeWidth={2.5} /></div>
                    <div onPointerDown={(e) => { e.stopPropagation(); deletePhoto(photo.id); }} className="absolute -top-5 -right-5 bg-white/95 p-2.5 rounded-full shadow-lg border border-stone-100 cursor-pointer text-rose-500 hover:bg-rose-50 hover:scale-110 active:scale-95 transition-all z-50"><Trash2 size={18} strokeWidth={2.5} /></div>

                    <div className="absolute inset-0 border-2 border-dashed border-blue-500/80 pointer-events-none rounded-sm"></div>
                </div>
            )}

            {isEditMode && !isSelected && !photo.isLocked && !isDrawingMode && (
                <div className="absolute inset-0 border-2 border-dashed border-blue-400/0 group-hover:border-blue-400/50 pointer-events-none rounded-sm transition-colors print:hidden"></div>
            )}
        </div>
    );
}