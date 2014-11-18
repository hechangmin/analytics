/**
 * 配置文件
 * @author hechangmin@gmail.com
 * @date 2011.11.18
 */

module.exports = {
    table_name : 'analytics:table_name',
    sql_list : 'analytics:sql_list',
    max_count : 10,
    port : 80,
    mysql :  {
        host     : '127.0.0.1',
        port     : 3306,
        database : 'pinfo',
        user     : 'root',
        password : 'admin'
    },
    redis : {
        host : '127.0.0.1',
        port : 6379
    },
    log : {
        appenders: [{
            type: 'file',
            filename: './log/error.log',
            maxLogSize: 204800,
            backups: 10,
            category: 'error'
        }
        //,{type: 'console'}
        ]
        /*,replaceConsole : true*/
    }
};