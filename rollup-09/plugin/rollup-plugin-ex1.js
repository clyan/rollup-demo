
const rollupPluginEx1 = function() {
    return {
        //  async, parallel
        buildStart(options) {
            console.log("ex1")
            setTimeout(() => {
                console.log('ex1 start')
            },30)
        },
        // async, first 
        resolveId(id) {
            return "a.js";
        },
        // sync, sequential
        outputOptions() {
            console.log('ex1 outputOptions')
            setTimeout(()=> {
                console.log('ex1 settimeout outputOptions')
            }, 20)
        },
    }
}

export default rollupPluginEx1