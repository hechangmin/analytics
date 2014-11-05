/**
 * 微型数据采集服务
 *
 * @author hechangmin@gmail.com
 * @date 2014.9.11
 * @remark
 *     1. 服务部署建议启用lvs, 数据库方面，建议，主库只写，从库只读。
 *     2. 如果产品规模已经超过这个系统能承受的压力，请另行考虑hadoop、mapreduce等其他方案。
 */

(function(configs) {
    var db;
    var redisConn;
    var httpServer;
    var mapQuery;
    var urlParams;
    var logger;
    var url = require('url');
    var http = require('http');
    var redis = require('redis');
    var mysql = require('mysql');
    var moment = require('moment');
    var cluster = require('cluster');
    var numCPUs = require('os').cpus().length;
    var log4js = require('log4js');

    function crearServer() {
        httpServer = http.createServer();
        httpServer.on('request', handleRequest);
        httpServer.listen(configs.port);
    }

    function handleRequest(req, res) {
        if(-1 === req.url.indexOf('/favicon.ico')){
            mapQuery = null;
            urlParams = null;
            parse(req);
        }
        res.setHeader("Content-Type", 'image/gif;charset=UTF-8');
        res.end('ok');
    }

    function parse(req) {
        var localTime = moment().format('HH:mm:ss');
        var sql = '("';
        var node = get(req, 'node');
        var snode = get(req, 'snode');
        var name = get(req, 'name');

        //关键字段不能为空
        if( '' === node || '' === snode || '' === name){
            error('param error:', req.url);
        }else{
            sql += getIp(req) + '","';
            sql += localTime + '","';
            sql += node + '","';
            sql += snode + '","';
            sql += get(req, 'uuid') + '","';
            sql += name + '","';
            sql += get(req, 'cid') + '","';
            sql += get(req, 'from') + '","';
            sql += get(req, 'client_v') + '","';
            sql += get(req, 'browser_v') + '","';
            sql += get(req, 'path') + '","';
            sql += get(req, 'action') + '","';
            sql += get(req, 'ab_name') + '")'; 
            save(sql);
        }
    }

    function save(sql) {

        var sqls = 'INSERT INTO `' + getTabName() + '` (`ip`,`time`,`node`,`snode`,`uuid`,`name`,`cid`,`from`,`client_v`,`browser_v`,`path`,`action`,`ab_name`) VALUES ', arrSqls = [];
        
        //debug
        //console.log('sql:', sql);

        redisConn.RPUSH(configs.sql_list, sql, function(err, length){
            if(err){
               console.log('Error : redis RPUSH ', configs.sql_list, sql, err); 
            }else if(length > configs.max_count){

                console.log('run here', configs.max_count);

                for(var i = 0, j = 0 ; i <= configs.max_count; i++){
                    redisConn.LPOP(configs.sql_list, function(err, item){
                        
                        j++;

                        if(err){
                            console.log('Error : redis LPOP ', configs.sql_list, err);    
                        }else{                            
                            
                            arrSqls.push(item);
                            
                            if(j === configs.max_count) {

                                sqls += arrSqls.join(',') + ';';

                                //console.log(sqls);

                                db.query(sqls, function(err){
                                    if(err){
                                        console.log(err);
                                    }
                                }); 
                            }                       
                        }
                    });    
                }
            }
        });
    }

    function getTabName(){
        var curTableName = 'tab_' + moment().format('YYYYMMDD');
        
        //判断该表是否存在(利用redis，避免反复查询数据库)
        redisConn.SELECT(0, function(){
            redisConn.GET(configs.table_name, function(err, tabName){
                if(err){
                    console.log('Error : redis GET ', configs.table_name);    
                }else if(curTableName !== tabName){
                    redisConn.SET(configs.table_name, curTableName, function(err){
                        if(err){
                            console.log('Error : redis SET ', configs.table_name, ' ', curTableName);
                        }
                        createTable(curTableName);
                    });
                }
            });
        });
        
        return curTableName;
    }

    function get(req, key){
        if(!mapQuery){
            if(!urlParams){
                urlParams = url.parse(req.url, true);
            }
            mapQuery = urlParams.query || {};
        }

        return void 0 === mapQuery[key] ? '' : mapQuery[key];
    }

    function getIp(req){
        var h = req.headers, r = 'x-real-ip', x = 'x-forwarded-for', p = 'Proxy-Client-IP', w = 'WL-Proxy-Client-IP';
        var strIP = h[r] || h[x] || h[p] || h[w] || req.connection.remoteAddress;
        var nIP = 0, tempIP, index = 0;
        
        strIP = strIP.split(',')[0];
        tempIP = strIP.split('.');
        
        if(tempIP.length !== 4){
            return nIP;
        }

        while(index < 4){
            nIP += tempIP[index] << (24 - 8*index); 
            index++;
        }
        
        return nIP >>> 0;
    }

    function createTable(tableName) {
        var sql = 'CREATE TABLE IF NOT EXISTS `';
        sql += tableName + '`(';
        sql += '`id` int(10) NOT NULL AUTO_INCREMENT,';
        sql += '`ip` bigint(18) NOT NULL DEFAULT "0",';
        sql += '`time` time NOT NULL,';
        sql += '`node` int(10) NOT NULL DEFAULT "0",';
        sql += '`snode` int(10) NOT NULL DEFAULT "0",';
        sql += '`uuid` varchar(64) NOT NULL DEFAULT "",';
        sql += '`name` varchar(128) NOT NULL DEFAULT "",';
        sql += '`cid` int(10) NOT NULL DEFAULT "0",';
        sql += '`from` varchar(128) NOT NULL DEFAULT "",';
        sql += '`client_v` varchar(128) NOT NULL DEFAULT "",';
        sql += '`browser_v` varchar(128) NOT NULL DEFAULT "",';
        sql += '`path` varchar(128) NOT NULL DEFAULT "",';
        sql += '`action` varchar(128) NOT NULL DEFAULT "",';
        sql += '`ab_name` varchar(128) NOT NULL DEFAULT "",';
        sql += 'PRIMARY KEY (`id`)';
        sql += ') ENGINE=`MyISAM` AUTO_INCREMENT=1 DEFAULT CHARACTER SET utf8 COLLATE utf8_general_ci ROW_FORMAT=DYNAMIC CHECKSUM=0 DELAY_KEY_WRITE=0;';
        
        db.query(sql, function(err, list){
            if(err){
                console.log('created ', tableName, 'failed.', sql, err);
            }else{
                console.log('created ', tableName, 'succussed.');
            }
        });
    }
    
    function error(){
        logger = log4js.getLogger('error');
        logger.info.apply(logger, arguments);
    }

    function init() {
        if (cluster.isMaster) {
            console.log('[master] start.');
            for (var i = 0; i < numCPUs; i++) {
                cluster.fork();
            }

            cluster.on('exit', function(worker) {
                console.log('[worker ' + worker.id + '] died.');
                cluster.fork();
            });
        } else if (cluster.isWorker) {
            console.log('[worker ' + cluster.worker.id + '] start.');
            crearServer();
        }
    }

    if (!module.parent) {
        log4js.configure(configs.log);
        redisConn = redis.createClient(configs.redis.port, configs.redis.host);
        db = mysql.createConnection(configs.mysql);
        init();
    }
}({
    table_name : 'analytics:table_name',
    sql_list : 'analytics:sql_list',
    max_count : 2,
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
}));