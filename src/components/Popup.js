import React from 'react';
import { createPortal } from 'react-dom';
import { theme } from '../styles/theme';
import { AlertIcon, CheckCircleIcon } from './AppIcons';

function Popup({ isOpen, type = 'info', title, message, onConfirm, onCancel }) {
  if (!isOpen) return null;
  const s = theme.modal;

  const popupContent = (
    <div className={`${s.overlay} modal-overlay-transition`}>
      <div className={`${s.card} modal-card-transition`}>
        <div className={`${s.iconWrapper} ${type === 'danger' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'}`}>
          {type === 'danger' ? (
            <AlertIcon className="h-7 w-7" />
          ) : (
            <CheckCircleIcon className="h-7 w-7" />
          )}
        </div>
        <h3 className={s.title}>{title}</h3>
        <p className={`${s.message} whitespace-pre-line`}>{message}</p>
        <div className="flex flex-col gap-2">
          <button onClick={onConfirm} className={s.btnConfirm}>ยืนยัน</button>
          {onCancel && <button onClick={onCancel} className={s.btnCancel}>ยกเลิก</button>}
        </div>
      </div>
    </div>
  );

  return createPortal(popupContent, document.body);
}
export default Popup;
