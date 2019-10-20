// conexão com banco dde dados e importação de models
import Sequelize from 'sequelize';
// Importando os Models
import User from '../app/models/User';

// Importando o arquivo de configuração
import databaseConfig from '../config/database';

// colocar os models em um array
const models = [User];

class Database {
    constructor() {
        // variavel instanciando o metodo init
        this.init();
    }

    init() {
        // Essa variavel recebe  como parametro do sequelize o database que foi importado
        this.connection = new Sequelize(databaseConfig);
        // percorrer o array e para cada model executar o metodo init com a connection
        models.map(model => model.init(this.connection));
    }
}

export default new Database();