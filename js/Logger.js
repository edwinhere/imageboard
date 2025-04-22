class Logger {
    static enabled = false;

    static enable() {
        this.enabled = true;
    }

    static disable() {
        this.enabled = false;
    }

    static log(module, method, data = {}) {
        if (this.enabled) {
            console.log(`[${module}] ${method}:`, data);
        }
    }
}

export default Logger; 