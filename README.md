#analytics#

基于nodejs 开发的一个微型的数据采集服务。请不要用于商业，仅供学习和参考。

* 服务部署建议启用lvs, 数据库方面，建议，主库只写，从库只读。
* 如果产品规模已经超过这个系统能承受的压力，请考虑其他方案.


##usage##

```html
http://127.0.0.1/?node=98&snode=101&uuid=0000000&name=test&cid=10&from=cmbweb&client_v=1.0&browser_v=ie10&path=dsfsds&action=getname&ab_name=a
```

##License##

Released under the MIT license

_*[hechangmin@gmail.com](mailto://hechangmin@gmail.com)*_
