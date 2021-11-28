
const rollupPluginEx2 = function() {
    return {
        //  async, parallel
        buildStart(options) {
            console.log("ex2")
            setTimeout(() => {
                console.log('ex2 start')
            },20)
        },
        // async, first 
        resolveId(id) {
            return "b.js";
        },
        load() {
            console.log("ex2 load")
        },
        // sync, sequential
        outputOptions() {
            console.log('ex2 outputOptions')
            setTimeout(()=> {
                console.log('ex2 settimeout outputOptions')
            }, 10)
        },
    }
}

export default rollupPluginEx2