API Docs
 v1 
OAS3
/swagger/v1/swagger.json
Credit

GET
​/api​/v2​/Balance
Group

GET
​/api​/v2​/Group
POST
​/api​/v2​/Group
PUT
​/api​/v2​/Group
DELETE
​/api​/v2​/Group
SMS

GET
​/api​/v2​/GetSMS
GET
​/api​/v2​/SMS​/Status
GET
​/api​/v2​/MessageStatus
GET
​/api​/v2​/SendSMS
POST
​/api​/v2​/SendSMS
POST
​/api​/v2​/SendBulkSMS
GET
​/api​/v2​/SendBulkSMS
GET
​/api​/v2​/ReportSummary
POST
​/api​/v3​/SendSMS
POST
​/api​/v3​/SendBulkSMS
SenderId

GET
​/api​/v2​/SenderId
POST
​/api​/v2​/SenderId
PUT
​/api​/v2​/SenderId
DELETE
​/api​/v2​/SenderId
Template

GET
​/api​/v2​/Template
POST
​/api​/v2​/Template
PUT
​/api​/v2​/Template
DELETE
​/api​/v2​/Template
Schemas
ResponseBalanceModel{
currencySymbol	string
nullable: true
productType	integer($int32)
productTypeName	string
nullable: true
readOnly: true
credits	number($double)
totalCredits	string
nullable: true
readOnly: true
}
ResponseBalanceModelListResponseModel{
errorCode	integer($int32)
errorDescription	string
nullable: true
data	[...]
}
GroupDataModel{
groupId	integer($int32)
groupName	string
nullable: true
contactCount	integer($int64)
}
GroupDataModelIEnumerableResponseModel{
errorCode	integer($int32)
errorDescription	string
nullable: true
data	[...]
}
GroupAPIModel{
groupName	string
nullable: true
apiKey*	string
clientId*	string
}
StringResponseModel{
errorCode	integer($int32)
errorDescription	string
nullable: true
data	string
nullable: true
}
DataCodingSchemeinteger($int32)
Enum:
Array [ 3 ]
SingleSmsApiModel{
senderId	string
nullable: true
is_Unicode	boolean
is_Flash	boolean
isRegisteredForDelivery	boolean
validityPeriod	string
nullable: true
dataCoding	DataCodingSchemeinteger($int32)
Enum:
Array [ 3 ]
schedTime	string
nullable: true
groupId	string
nullable: true
message	string
nullable: true
mobileNumbers	string
nullable: true
serviceId	string
nullable: true
coRelator	string
nullable: true
linkId	string
nullable: true
principleEntityId	string
nullable: true
templateId	string
nullable: true
apiKey*	string
clientId*	string
}
MessageParameters{
number	string
nullable: true
text	string
nullable: true
serviceId	string
nullable: true
coRelator	string
nullable: true
linkId	string
nullable: true
}
BulkSmsApiModel{
senderId	string
nullable: true
isUnicode	boolean
isFlash	boolean
isRegisteredForDelivery	boolean
validityPeriod	string
nullable: true
dataCoding	DataCodingSchemeinteger($int32)
Enum:
Array [ 3 ]
scheduleDateTime	string
nullable: true
principleEntityId	string
nullable: true
templateId	string
nullable: true
messageParameters	[...]
apiKey*	string
clientId*	string
}
ResponseSenderIdModel{
id	integer($int64)
companyId	integer($int64)
senderId	string
nullable: true
productName	string
nullable: true
purpose	string
nullable: true
isActive	boolean
createDate	string($date-time)
createDateString	string
nullable: true
readOnly: true
approveStatus	integer($int32)
isApproved	string
nullable: true
readOnly: true
approvedDate	string($date-time)
nullable: true
approvedDateString	string
nullable: true
readOnly: true
isDefault	boolean
senderIdType	integer($int32)
type	string
nullable: true
readOnly: true
jobApprovalId	integer($int32)
jobStatus	integer($int32)
requestId	integer($int32)
}
ResponseSenderIdModelListResponseModel{
errorCode	integer($int32)
errorDescription	string
nullable: true
data	[...]
}
SenderIdAPIModel{
siteUserId	integer($int32)
id	integer($int64)
senderId*	string
purpose*	string
productId	integer($int32)
isActive	boolean
isApproved	integer($int32)
apiKey*	string
clientId*	string
}
ResponseTemplateModel{
templateId	integer($int64)
companyId	integer($int64)
templateName	string
nullable: true
messageTemplate	string
nullable: true
isApproved	boolean
isActive	boolean
productName	string
nullable: true
createDate	string($date-time)
createDateString	string
nullable: true
approvedDate	string($date-time)
nullable: true
approvedDateString	string
nullable: true
readOnly: true
dltTemplateId	string
nullable: true
}
ResponseTemplateModelListResponseModel{
errorCode	integer($int32)
errorDescription	string
nullable: true
data	[...]
}
TemplateAPIModel{
templateName*	string
messageTemplate*	string
templateId	string
nullable: true
apiKey*	string
clientId*	string
}