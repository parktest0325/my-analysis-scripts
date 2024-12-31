/*
open, fopen
close, fclose
read, fread, pread, readv,
write, fwrite, pwrite, writev
lseek, fseek, ftell, rewind
*/

function createColorGenerator() {
    const foregroundColors = [31, 32, 33, 36, 37, 90, 91, 92, 93, 94, 95, 96, 97];
    let fgIndex = 0;

    return function getNextColor() {
        const fg = foregroundColors[fgIndex++ % foregroundColors.length];
 
        return {
            fg,
            ansi: `\x1b[${fg}m`,
            reset: "\x1b[0m",
        };
    };
} 

const getNextColor = createColorGenerator();

// for (let i = 0; i < 20; i++) {
//     const { fg, ansi, reset } = getNextColor();
//     console.log(`${ansi}ColorTest: ${fg} ${reset}`);
// }


const targetFilePaths = [
    "/user_label/user_label_v4.db",
];

var fdMaps = new Map();

function isTargetFile(path) {
    for (var i = 0 ; i < targetFilePaths.length; i++) {
        if (path.includes(targetFilePaths[i])) {
            return i;
        }
    }
    return -1;
}

// Hooking the `open` function
Interceptor.attach(Module.findExportByName("libc.so", 'open'), {
    onEnter: function (args) {
        const path = Memory.readUtf8String(args[0]);
        const targetIdx = isTargetFile(path);
        if (targetIdx != -1) {
            this.isTarget = true;
            this.path = path;
            this.idx = targetIdx;
            this.color = getNextColor();
            this.backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join('\n\t');
        }
    },
    onLeave: function (retval) {
        if (this.isTarget) {
            var fd = retval.toInt32()
            const { fg, ansi, reset } = this.color;
            const value = {
                index: this.idx,
                path: this.path,
                filename: this.path.split('/').pop(),
                color: this.color,
            }
            console.log(`${ansi}[open - ${value['filename']}] FD: ${fd}, Path: ${this.path} ${reset}`);
            const backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join('\n\t');
            console.log(ansi + "[*] Native Call Stack:\n\t" + this.backtrace + reset);
            fdMaps.set(fd, value);
        }
    }
});


var readHook = Interceptor.attach(Module.findExportByName("libc.so", 'read'), {
    onEnter: function (args) {
        const fd = args[0].toInt32();
        if (fdMaps.has(fd)) {
            this.fd = fd;
            this.buf = args[1];
            this.count = args[2].toInt32();
            this.isTarget = true;
            this.backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join('\n\t');
        }
    },
    onLeave: function (retval) {
        if (this.isTarget) {
            const data = ''; // Memory.readCString(this.buf, Math.min(0x20, Math.min(this.count, retval.toInt32())));
            const value = fdMaps.get(this.fd);
            const { fg, ansi, reset } = value['color'];
            console.log(`${ansi}[read - ${value['filename']}] FD: ${this.fd}, Data: ${data} ${reset}`);
            console.log(ansi + "[*] Native Call Stack:\n\t" + this.backtrace + reset);
            readHook.detach();
        }
    }
});

var writeHook = Interceptor.attach(Module.findExportByName("libc.so", 'write'), {
    onEnter: function (args) {
        const fd = args[0].toInt32();
        if (fdMaps.has(fd)) {
            const buf = args[1];
            const count = args[2].toInt32();
            const data = ''; // Memory.readCString(buf,Math.min(0x20, count));
            const value = fdMaps.get(fd);
            const { fg, ansi, reset } = value['color'];
            console.log(`${ansi}[write - ${value['filename']}] FD: ${fd}, Data: ${data} ${reset}`);

            this.backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join('\n\t');
            console.log(ansi + "[*] Native Call Stack:\n\t" + this.backtrace + reset);
            writeHook.detach();
        }
    }
});

Interceptor.attach(Module.findExportByName("libc.so", 'close'), {
    onEnter: function (args) {
        const fd = args[0].toInt32();
        if (fdMaps.has(fd)) {
            const value = fdMaps.get(fd);
            const { fg, ansi, reset } = value['color'];
            console.log(`${ansi}[close - ${value['filename']}] FD: ${fd} ${reset}`);
            fdMaps.delete(fd);

            this.backtrace = Thread.backtrace(this.context, Backtracer.ACCURATE)
                .map(DebugSymbol.fromAddress)
                .join('\n\t');
            console.log(ansi + "[*] Native Call Stack:\n\t" + this.backtrace + reset);
        }
    }
});