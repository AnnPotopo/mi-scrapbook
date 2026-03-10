export const compressImage = (file) => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_SIZE = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                    }
                } else {
                    if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.7));
            };
        };
    });
};

export const POSTIT_COLORS = {
    yellow: 'bg-yellow-200 border-yellow-100 text-yellow-900 shadow-yellow-900/20',
    blue: 'bg-blue-200 border-blue-100 text-blue-900 shadow-blue-900/20',
    pink: 'bg-pink-200 border-pink-100 text-pink-900 shadow-pink-900/20',
    green: 'bg-green-200 border-green-100 text-green-900 shadow-green-900/20',
    purple: 'bg-purple-200 border-purple-100 text-purple-900 shadow-purple-900/20',
};
