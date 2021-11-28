import { version } from '../package.json'
import ElAlert from '../packages/alert'
import ELBacktop from '../packages/backtop'
const components = [
    ElAlert,
]

const install = (app, opts = {}) => {
    components.forEach((component) => {
        app.use(component)
    })

    applyOptions(app)
}
const element3 = {
    version,
    install
}
export {
    version,
    ElAlert,
    ELBacktop,
    install,
}
  export default element3  